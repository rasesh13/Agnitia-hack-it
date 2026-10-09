# Backend

The backend is a single FastAPI application in `backend/`. It serves the REST API and the WebSocket hub, runs the decision-optimisation loop and the ML fluctuation stream as background tasks, and persists everything through SQLAlchemy async.

Related: [api-reference.md](api-reference.md) · [database.md](database.md) · [workflows.md](workflows.md) · [ml-and-forecasting.md](ml-and-forecasting.md) · [authentication-and-authorization.md](authentication-and-authorization.md)

---

## 1. Layout

```text
backend/
├── main.py                 # create_app(), lifespan, root page, router registration
├── config.py               # Settings (pydantic-settings), get_settings() singleton
├── core/logging.py         # JSON log formatter, setup_logging()
├── api/
│   ├── deps.py             # get_current_user, require_roles(...)
│   ├── middleware.py       # RequestCorrelationMiddleware, error-envelope handlers
│   ├── rate_limit.py       # in-memory per-IP sliding window
│   └── routes_*.py         # auth, health, twin, decisions, control, settings, export, forecast
├── ws/                     # WebSocketManager singleton + /ws route
├── services/               # business logic (optimisers, scheduler, ML, export)
├── adapters/               # REST / Modbus / MQTT / stub hardware adapters (not wired at runtime)
├── models/                 # SQLAlchemy models + Pydantic schemas
├── db/
│   ├── database.py         # engine, session factory, get_db, init_db, close_db
│   ├── repositories/       # UserRepository, TwinRepository, DecisionRepository
│   ├── seed_demo_data.py   # idempotent Prestige University seed
│   └── migrations/         # Alembic env + versions 001, 002
├── scripts/seed_dev.py     # destructive standalone dev seed (drops tables)
├── Dockerfile, entrypoint.sh
```

The package also imports `training/step5_test_and_train_custom_region.py` from `backend/api/routes_forecast.py`, so `training/` must be on the import path. That works when running from the repository root.

## 2. Startup sequence

`uvicorn backend.main:app` imports `backend.main`, which calls `create_app()`. The `lifespan` context manager in `backend/main.py` then runs:

1. `get_settings()` loads and validates `Settings` from the environment and `.env`. A validation failure aborts startup.
2. `setup_logging()` installs the JSON formatter on the root logger (stdout, INFO).
3. If `ENVIRONMENT` is `development` or `test`, `init_db()` runs `create_all`.
4. If `ENVIRONMENT` is `development` or `test`, or `SEED_DEMO_DATA` is true, `seed_prestige_microgrid()` runs.
5. A `DecisionScheduler` is created with the session factory and `ws_manager.broadcast` as its callback, registered for `/health/scheduler`, and **started unconditionally**. `SCHEDULER_ENABLED` is not checked.
6. `ml_sync_service.start_background_streaming(interval_seconds=3.0, site_id=1, region_id="central_india_mp_indore")` starts.

Importing `backend.main` also has side effects:

- `agnitia_ml_forecaster.ml_forecaster` loads the model files at import time.
- `training/step5_...` creates its output directories at import time (`mkdir` on `D:\...`, falling back to relative `datasets/` and `model_files/`).

On shutdown, the lifespan stops the ML stream, stops the scheduler (waiting up to 5 s for it to finish) and disposes the DB engine.

## 3. Middleware and request handling

Registration order in `create_app()`:

1. `RequestCorrelationMiddleware`: sets `request.state.request_id` and the `X-Request-ID` response header.
2. `CORSMiddleware`: `allow_origins=CORS_ORIGINS`, `allow_credentials=True`, all methods and headers. Because it is added last, it is the **outermost** layer.
3. Exception handlers for `HTTPException`, `RequestValidationError` and `Exception`, all of which produce the error envelope.
4. Routers: health, auth, twin, decisions, settings, control, export, forecast, ws.

No security-header, compression or trusted-host middleware is configured in the app. The nginx config adds security headers and gzip in the Docker deployment.

Dependencies:

- `get_db`: one `AsyncSession` per request.
- `get_current_user`: Bearer JWT → `TokenPayload` → `User` (active, matching `token_version`).
- `require_roles(...)`: builds role guards. The shortcuts are `require_admin`, `require_operator_or_admin` and `require_viewer_or_above`.

## 4. Configuration

`backend/config.py` defines `Settings(BaseSettings)` with `env_file=".env"`, `case_sensitive=True` and `extra="ignore"`.

Startup validation:

- `COST_WEIGHT + CARBON_WEIGHT` must equal 1 (±1e-4).
- `ALERT_CRITICAL_BATTERY_SOC < ALERT_LOW_BATTERY_SOC`.
- `BATTERY_MIN_SOC < BATTERY_MAX_SOC`.
- `ALERT_RESERVE_FLOOR_PERCENT ≥ BATTERY_MIN_SOC`.
- `TELEMETRY_POLL_INTERVAL < STALE_AFTER < FAILURE_AFTER`.
- In production: no `*` in CORS, a strong `JWT_SECRET_KEY`, and no stub adapter type.

`get_settings()` caches one instance per process. `PUT /api/v1/settings/control-policy` mutates that cached object.

Many settings are declared but not read by runtime code: the adapter settings, alert thresholds, tariffs, retention, `SCHEDULER_ENABLED` and `CLOSED_LOOP_CONTROL_ENABLED`. The full table is in [environment-configuration.md](environment-configuration.md).

## 5. Services

| Module | Key class / function | What it does | Used at runtime by |
| --- | --- | --- | --- |
| `scheduler.py` | `DecisionScheduler` | Loop: `execute_cycle()` then wait `DECISION_CYCLE_SECONDS`. Holds the `emergency_stop_active` and `closed_loop_enabled` flags (both start `False`) and failure counters. Broadcasts `full_cycle`. | lifespan, `/control/*`, `/settings/control-policy`, `/health/scheduler` |
| `decision_manager.py` | `DecisionManager.run_decision_cycle` | The cycle pipeline; see [workflows.md](workflows.md#decision-cycle) | scheduler, force-cycle, ML sync |
| `forecast_engine.py` | `ForecastEngine.generate_campus_forecast` | 4 h × 15 min heuristic forecast (diurnal solar factor plus persistence), flags degraded data | decision manager |
| `reliability_guard.py` | `ReliabilityGuard` | Usable vs. reserve battery discharge, supply adequacy, deterministic shedding order (non-critical first), emergency decisions | decision manager |
| `dispatch_optimizer.py` | `DispatchOptimizer` | Builds up to 5 candidate strategies, scores them with `w_cost·norm_cost + w_carbon·norm_carbon`, tie-breaks on reliability margin, carbon, cost, then ID | decision manager |
| `cost_optimizer.py`, `carbon_optimizer.py` | `CostOptimizer`, `CarbonOptimizer` | Interval cost (import, export credit, battery wear) and emissions | dispatch optimiser |
| `battery_scheduler.py` | `BatteryScheduler` | SoC limits, temperature and health derating, clamps charge and discharge | decision manager (only when battery configs are passed) |
| `vnm_optimizer.py` | `VNMOptimizer` | Proportional or critical-first allocation of renewable kWh to buildings | decision manager (only when rules and building configs are passed) |
| `load_advisor.py` | `LoadAdvisor` | Recommends moving flexible building load into forecast surplus windows | decision manager (only when building configs are passed) |
| `digital_twin_store.py` | `DigitalTwinStore`, `CampusAggregate` | Campus totals from asset states; snapshot ingestion | twin routes, decision manager, ML sync |
| `telemetry_quality.py` | functions | Unit normalisation, plausibility, stale/missing classification | adapters and tests only |
| `agnitia_ml_forecaster.py` | `AgnitiaMLForecaster` (`ml_forecaster` singleton) | Model loading, `forecast_48h`, `predict_realtime_point`, `get_realtime_weather` | forecast and twin routes, ML sync |
| `ml_microgrid_sync.py` | `MLMicrogridSyncService` (`ml_sync_service` singleton) | Reset to zero, apply ML prediction, fluctuation step and stream, comparison | lifespan, forecast and twin routes |
| `export_service.py` | `ExportService` | Stats, CSV (with `#` comment disclosures), PDF via ReportLab | export routes |
| `auth_crypto.py` | `hash_password`, `verify_password`, `create_access_token`, `decode_access_token` | Argon2id (time 3, memory 64 MiB, parallelism 4), HS256 JWT | auth, deps, ws |
| `google_identity.py` | `verify_google_id_token(_async)` | RS256 JWKS verification, run in a thread | auth |

> **Wiring gap:** `DecisionScheduler.execute_cycle()` is called with no `building_configs`, `battery_configs` or `vnm_rules`, and so are the cycles started by force-cycle and the ML stream. `DecisionManager` treats a missing value as empty. As a result, the running system produces only **dispatch** decisions, plus reliability decisions in an emergency. It never produces battery, VNM or load-shift decisions, and never produces control commands, even with closed loop enabled. The local development database shows this: 889 cycles, 865 decision logs, 0 control commands. The battery, VNM and load-shift services are exercised only by unit tests.

## 6. Hardware adapter layer (not wired)

`backend/adapters/` defines `EnergyAdapter` (`start`, `stop`, `read_snapshot`, `write_command`, `health`) with these implementations:

- `RestEnergyAdapter`: uses httpx.
- `ModbusEnergyAdapter`: a raw Modbus TCP client over asyncio streams.
- `MQTTEnergyAdapter`: inbound messages are pushed in through `handle_inbound_message`; it has no broker client.
- `InMemoryTestAdapter`.

`AdapterSiteConfig` (`adapters/site_config.py`) maps asset metrics to JSON paths, registers or topics.

`DecisionScheduler` accepts a `snapshot_provider` callback, but `main.py` does not pass one, and `ADAPTER_TYPE`, `ADAPTER_HOST` and `ADAPTER_PORT` are never read outside `Settings`. Connecting real hardware means building an adapter from settings, starting it in the lifespan, and passing `adapter.read_snapshot` as the scheduler's snapshot provider. See [contributing.md](contributing.md#adding-an-integration).

## 7. Data access

`get_db` gives one session per request. Repository classes cover users, twin reads and upserts, and decision persistence and statistics. Background tasks open their own sessions from `get_session_maker()`. See [database.md](database.md#8-data-access-patterns).

## 8. Error handling and logging

- Routes raise `HTTPException(detail={"code", "message", "details"?})`, which is turned into the error envelope.
- `core/logging.py` writes one JSON object per line with `timestamp`, `level`, `service`, `logger`, `message`, the optional extras `request_id`, `cycle_id`, `user_id`, `asset_id` and `event`, and `exception`.
  - `SENSITIVE_KEYS` is declared but **not applied**: nothing is redacted.
  - The level is fixed at INFO; there is no `LOG_LEVEL` setting.
- Loggers used: `surya.api`, `surya.scheduler`, `surya.websocket`, `surya.ws_router`, `surya.ml_sync` and the forecaster's logger.
- No metrics, tracing or external log shipping is configured.

## 9. Concurrency

- **Event loop:** one asyncio loop per worker runs the request handlers, `decision-scheduler-loop` and the ML stream task.
- **Cycle lock:** `DecisionScheduler._lock` prevents overlapping scheduler cycles. The ML stream's cycles run **outside** this lock and ignore the emergency-stop flag.
- **Blocking work:**
  - `verify_google_id_token_async` uses `asyncio.to_thread`.
  - `get_realtime_weather` uses blocking `urllib` (5 s timeout, at most once per 60 s per region).
  - `POST /forecast/train-region` trains models synchronously in the handler.
- **Shared state:** see [architecture.md §9](architecture.md#process-model-constraint) for why exactly one worker is required.

## 10. Running

```bash
# from the repository root, with the virtualenv active
uvicorn backend.main:app --reload --port 8000
```

- **Production (Render):** `alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"`.
- **Docker:** `backend/entrypoint.sh` runs `alembic upgrade head`; a failure is logged but does not stop startup. It then starts `uvicorn ... --workers ${WORKERS:-4}`. Set `WORKERS=1`.

Interactive docs are served at `/docs` and `/redoc` in every environment.
