# API Reference

This reference covers every HTTP and WebSocket route registered in `backend/main.py`, checked against the router source files in `backend/api/` and `backend/ws/`. FastAPI also generates an interactive OpenAPI description at runtime; it is the authoritative schema for request and response models:

- Swagger UI: `GET /docs`
- ReDoc: `GET /redoc`
- OpenAPI JSON: `GET /openapi.json`

These are enabled in all environments, including production.

Related: [authentication-and-authorization.md](authentication-and-authorization.md) · [backend.md](backend.md) · [database.md](database.md)

---

## 1. Conventions

### Base URL

| Environment | Base URL |
| --- | --- |
| Local development | `http://127.0.0.1:8000` (the default `BACKEND_PORT` in the docs); any port you pass to `uvicorn --port` |
| Docker Compose | `http://localhost:8000` directly, or `http://localhost/api/...` through nginx |
| Render (per `render.yaml`) | The URL Render assigns to the `surya-backend` service |

### Authentication

Protected routes need an `Authorization: Bearer <access_token>` header, using the token returned by `/api/v1/auth/login`, `/signup` or `/google`. Role requirements are listed per route:

| Notation | Meaning (from `backend/api/deps.py`) |
| --- | --- |
| **Public** | No token needed |
| **Any user** | `get_current_user`: valid, unexpired, unrevoked token for an active user |
| **Viewer+** | `require_viewer_or_above`: role `admin`, `operator` or `viewer` (in practice any user) |
| **Operator+** | `require_operator_or_admin` |
| **Admin** | `require_admin` |

### Content types

Request bodies are `application/json`. Pydantic models with `extra="forbid"` reject unknown fields with `422`.

### Error envelope

Every `HTTPException`, validation error and unhandled exception is converted to this shape by `backend/api/middleware.py`:

```json
{
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Access token has expired. Please sign in again.",
    "request_id": "6f1c0c1e-6a43-4c39-9a53-2a3b3b0b8b51",
    "details": null
  }
}
```

| Status | `code` values seen in the code |
| --- | --- |
| 401 | `AUTH_REQUIRED`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_REVOKED`, `USER_NOT_FOUND_OR_INACTIVE`, `INVALID_CREDENTIALS`, `GOOGLE_TOKEN_INVALID` |
| 403 | `FORBIDDEN` (role check), `USER_INACTIVE` |
| 404 | `SITE_NOT_FOUND`, `CYCLE_NOT_FOUND`, `DECISION_NOT_FOUND`, `COMMAND_NOT_FOUND`, `THRESHOLD_NOT_FOUND`, `BUILDING_CONFIG_NOT_FOUND`, `VNM_RULE_NOT_FOUND`, `BATTERY_CONFIG_NOT_FOUND` |
| 409 | `USER_ALREADY_EXISTS`, `CYCLE_LOCKED` |
| 422 | `VALIDATION_ERROR` (`details.errors` holds the Pydantic error list) |
| 429 | `RATE_LIMIT_EXCEEDED` (`details.retry_after_seconds`) |
| 500 | `INTERNAL_SERVER_ERROR`, or `HTTP_500` for `/forecast/train-region` failures |
| 503 | `GOOGLE_AUTH_NOT_CONFIGURED`, `DATABASE_UNAVAILABLE` |

When `detail` is a plain string (only `/forecast/train-region` does this), `code` becomes `HTTP_<status>`.

### Correlation ID

`RequestCorrelationMiddleware` reads `X-Request-ID` from the request, or generates a UUID, and returns it in the `X-Request-ID` response header and in `error.request_id`.

### Rate limiting

Rate limiting is implemented **only** for the routes listed below, using the in-memory, per-process, per-IP sliding window in `backend/api/rate_limit.py`. The client IP is taken from the first `X-Forwarded-For` entry when present.

| Route | Limit |
| --- | --- |
| `POST /api/v1/auth/signup` | 10 / 60 s |
| `POST /api/v1/auth/login` | 15 / 60 s |
| `POST /api/v1/auth/google` | 10 / 60 s |
| `POST /api/v1/control/force-cycle` | 10 / 60 s |

### Site scoping

Most routes take `site_id` (default `1`). There is no per-user site authorization: any authenticated user can read any `site_id`.

---

## 2. Endpoint summary

| # | Method | Path | Auth | Purpose |
| --- | --- | --- | --- | --- |
| | **Root and health** | | | |
| 1 | GET | `/` | Public | HTML landing page, or JSON metadata when `Accept: application/json` (hidden from OpenAPI) |
| 2 | GET | `/health` | Public | Liveness |
| 3 | GET | `/health/ready` | Public | Readiness with a DB check |
| 4 | GET | `/health/scheduler` | Public | Decision-scheduler diagnostics |
| | **Authentication** (`/api/v1/auth`) | | | |
| 5 | POST | `/api/v1/auth/signup` | Public | Register with email and password |
| 6 | POST | `/api/v1/auth/login` | Public | Email and password login |
| 7 | POST | `/api/v1/auth/google` | Public | Google ID-token login or signup |
| 8 | GET | `/api/v1/auth/me` | Any user | Current profile |
| 9 | POST | `/api/v1/auth/logout` | Any user | Revoke all of the user's tokens |
| | **Digital twin and telemetry** (`/api/v1`) | | | |
| 10 | GET | `/api/v1/twin/site` | Any user | Site metadata |
| 11 | GET | `/api/v1/twin/buildings` | Any user | Buildings with live load |
| 12 | GET | `/api/v1/twin/assets` | Any user | Assets with live state (filterable) |
| 13 | GET | `/api/v1/twin/live` | Any user | Site, aggregates and all asset states |
| 14 | GET | `/api/v1/telemetry/series` | Any user | Historical points for one asset metric |
| 15 | POST | `/api/v1/twin/reset-to-zero` | **Public** ⚠ | Set all asset power to 0 |
| 16 | POST | `/api/v1/twin/apply-ml-prediction` | **Public** ⚠ | Apply ML prediction to all assets |
| 17 | GET | `/api/v1/twin/ml-comparison` | **Public** | Zero baseline vs. ML comparison |
| 18 | POST | `/api/v1/twin/fluctuate-step` | **Public** ⚠ | One live fluctuation step |
| 19 | POST | `/api/v1/twin/fluctuate-stream/start` | **Public** ⚠ | Start the background stream |
| 20 | POST | `/api/v1/twin/fluctuate-stream/stop` | **Public** ⚠ | Stop the background stream |
| 21 | GET | `/api/v1/twin/fluctuate-stream/status` | **Public** | Stream status |
| | **Decisions** (`/api/v1/decisions`) | | | |
| 22 | GET | `/api/v1/decisions` | Viewer+ | Paginated decision log |
| 23 | GET | `/api/v1/decisions/latest` | Viewer+ | Latest cycle with decisions and alternatives |
| 24 | GET | `/api/v1/decisions/stats` | Viewer+ | Aggregates by decision type |
| 25 | GET | `/api/v1/decisions/{decision_id}` | Viewer+ | One decision with its commands |
| | **Control** (`/api/v1/control`) | | | |
| 26 | POST | `/api/v1/control/force-cycle` | Operator+ | Run a decision cycle now |
| 27 | POST | `/api/v1/control/commands/{command_id}/acknowledge` | Operator+ | Update a command's status |
| 28 | POST | `/api/v1/control/emergency-stop` | Admin | Engage or release emergency stop |
| | **Settings** (`/api/v1/settings`) | | | |
| 29 | GET | `/api/v1/settings/alert-thresholds` | Viewer+ | List thresholds |
| 30 | GET | `/api/v1/settings/alert-thresholds/{threshold_id}` | Viewer+ | Get a threshold |
| 31 | PUT | `/api/v1/settings/alert-thresholds/{threshold_id}` | Admin | Update a threshold |
| 32 | GET | `/api/v1/settings/building-tiers` | Viewer+ | List building configs |
| 33 | GET | `/api/v1/settings/building-tiers/{building_id}` | Viewer+ | Get a building config (by numeric ID or asset ID) |
| 34 | PUT | `/api/v1/settings/building-tiers/{building_id}` | Admin | Update a building config |
| 35 | GET | `/api/v1/settings/vnm-sharing-rules` | Viewer+ | List VNM rules |
| 36 | GET | `/api/v1/settings/vnm-sharing-rules/{rule_id}` | Viewer+ | Get a VNM rule |
| 37 | POST | `/api/v1/settings/vnm-sharing-rules` | Admin | Create a VNM rule |
| 38 | PUT | `/api/v1/settings/vnm-sharing-rules/{rule_id}` | Admin | Update a VNM rule |
| 39 | GET | `/api/v1/settings/assets` | Viewer+ | List battery configs |
| 40 | GET | `/api/v1/settings/assets/{asset_id}` | Viewer+ | Get a battery config |
| 41 | PUT | `/api/v1/settings/assets/{asset_id}/battery` | Admin | Update a battery config |
| 42 | GET | `/api/v1/settings/control-policy` | Viewer+ | Closed-loop, E-stop and weights |
| 43 | PUT | `/api/v1/settings/control-policy` | Admin | Update the control policy |
| | **Export** (`/api/v1/export`) | | | |
| 44 | GET | `/api/v1/export/csv` | Viewer+ | CSV report download |
| 45 | GET | `/api/v1/export/pdf` | Viewer+ | PDF report download |
| 46 | GET | `/api/v1/export/stats` | Viewer+ | Report KPIs as JSON |
| | **Forecasting and ML** (`/api/v1/forecast`) — all public | | | |
| 47 | GET | `/api/v1/forecast/regions` | Public | Available regions |
| 48 | GET | `/api/v1/forecast/48h` | Public | 48-hour hourly forecast |
| 49 | GET | `/api/v1/forecast/metrics` | Public | Model evaluation metrics |
| 50 | POST | `/api/v1/forecast/reload` | **Public** ⚠ | Reload model files from disk |
| 51 | POST | `/api/v1/forecast/train-region` | **Public** ⚠ | Train models for a new region (long-running) |
| 52 | GET | `/api/v1/forecast/site-metrics` | Public | Site sensor model metrics (hard-coded local path) |
| 53 | POST | `/api/v1/forecast/reset-to-zero` | **Public** ⚠ | Same as #15 for site 1 |
| 54 | POST | `/api/v1/forecast/apply-prediction` | **Public** ⚠ | Same as #16, with optional custom weather |
| 55 | GET | `/api/v1/forecast/live-comparison` | Public | Same as #17 for site 1 |
| 56 | POST | `/api/v1/forecast/fluctuate-step` | **Public** ⚠ | Same as #18 for site 1 |
| 57 | POST | `/api/v1/forecast/fluctuate-stream/start` | **Public** ⚠ | Same as #19 for site 1 |
| 58 | POST | `/api/v1/forecast/fluctuate-stream/stop` | **Public** ⚠ | Same as #20 |
| 59 | GET | `/api/v1/forecast/fluctuate-stream/status` | Public | Same as #21 |
| 60 | GET | `/api/v1/forecast/weather-live` | Public | Live weather and physics baseline |
| | **WebSocket** | | | |
| 61 | WS | `/ws?token=<jwt>` | Valid JWT | Real-time event stream |

⚠ = state-changing route with no authentication. See [security.md](security.md#findings).

---

## 3. Root and health

### `GET /health`

Liveness probe used by Render (`healthCheckPath`) and both Dockerfiles. It does not touch the database.

```json
{ "status": "ok", "service": "surya-backend", "timestamp": "2026-10-09T10:15:02.118Z" }
```

### `GET /health/ready`

Runs `SELECT 1`. Returns `200`:

```json
{
  "status": "ready",
  "timestamp": "...",
  "components": { "database": "healthy", "environment": "development", "scheduler_enabled": true }
}
```

Returns `503 DATABASE_UNAVAILABLE` if the query fails; the error `details` include the exception text. `scheduler_enabled` reflects the `SCHEDULER_ENABLED` setting, which the lifespan does not actually honour (the scheduler always starts).

### `GET /health/scheduler`

```json
{
  "status": "healthy",
  "timestamp": "...",
  "scheduler": {
    "is_running": true,
    "is_locked": false,
    "closed_loop_enabled": false,
    "emergency_stop_active": false,
    "decision_cycle_seconds": 10,
    "last_cycle_started_at": "...",
    "last_cycle_completed_at": "...",
    "last_cycle_status": "degraded",
    "last_cycle_duration_ms": 41.7,
    "last_cycle_id": "c1d2...",
    "consecutive_failures": 0,
    "total_cycles_executed": 120,
    "total_cycles_failed": 0,
    "last_error": null,
    "next_cycle_in_seconds": 6.3
  }
}
```

`status` is `degraded` when `consecutive_failures > 0`, and `idle` (with a `message` and no `scheduler` object) if no scheduler is registered in the process.

### `GET /`

Returns a static HTML page. With `Accept: application/json` it returns `service`, `version` (`0.1.0`), `status`, `environment`, `docs_url`, `redoc_url`, `health_url` and `frontend_console`. Some text on the HTML page is static marketing copy (for example it always shows "PostgreSQL 16" and "PRODUCTION ENGINE ONLINE"), whatever the actual configuration.

---

## 4. Authentication

Full flow details: [authentication-and-authorization.md](authentication-and-authorization.md).

### `POST /api/v1/auth/signup`

| Field | Type | Rules |
| --- | --- | --- |
| `email` | string | Required, valid email (`EmailStr`) |
| `password` | string | Required, 8–128 characters |

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"new.user@example.com","password":"a-long-password"}'
```

`201 Created` → `TokenResponse`:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 7200,
  "user": { "id": 3, "email": "new.user@example.com", "role": "viewer", "is_active": true, "created_at": "..." }
}
```

- **Side effect:** creates a user. The **first** user in an empty database becomes `admin`; everyone after that becomes `viewer`. In development and demo deployments the seed has already created users, so new signups are always `viewer`.
- **Errors:** `409 USER_ALREADY_EXISTS`, `422`, `429`.

### `POST /api/v1/auth/login`

Body: `{ "email": string, "password": string }`. Returns `200` with a `TokenResponse`.

- **Errors:** `401 INVALID_CREDENTIALS` (unknown email, wrong password, or a Google-only account with no password), `403 USER_INACTIVE`, `429`.

### `POST /api/v1/auth/google`

Body: `{ "id_token": "<Google ID token JWT>" }`. Returns `200` with a `TokenResponse`.

- **Verification:** the token is verified against Google's JWKS (RS256, audience = `GOOGLE_CLIENT_ID`, issuer, and `email_verified` must be true).
- **User lookup:** by `google_sub`, then by email (which links the Google account to an existing user), otherwise a new user is created.
- **New-user role:** `admin` if the database is empty, otherwise **`operator`**. A hard-coded email address is always promoted to `admin`.
- **Errors:** `503 GOOGLE_AUTH_NOT_CONFIGURED` when `GOOGLE_CLIENT_ID` is unset, `401 GOOGLE_TOKEN_INVALID`, `429`.

### `GET /api/v1/auth/me`

Returns a `UserReadResponse`: `id`, `email`, `role`, `is_active`, `created_at`.

### `POST /api/v1/auth/logout`

Increments `users.token_version`, which invalidates **every** token issued to that user on all devices.

```json
{ "message": "Session successfully invalidated." }
```

---

## 5. Digital twin and telemetry

All routes read from `asset_current_state` (latest values) and `telemetry_points` (history).

### `GET /api/v1/twin/site?site_id=1`

Returns `id`, `name`, `timezone`, `jurisdiction`, `currency`, `config_version` and `total_assets`. `404 SITE_NOT_FOUND` if the site does not exist.

### `GET /api/v1/twin/buildings?site_id=1`

Returns an array of:

```json
{
  "asset_id": "bldg-admin",
  "name": "Central Administration & Computing Centre",
  "criticality_tier": "critical",
  "peak_load_kw": 75.0,
  "flexible_load_policy": "uninterruptible",
  "current_power_kw": 61.4,
  "operational_status": "online",
  "telemetry_quality": "good",
  "observed_at": "...",
  "received_at": "...",
  "age_seconds": 2.1
}
```

Buildings without a state row are reported as `operational_status: "offline"` and `telemetry_quality: "missing"`.

### `GET /api/v1/twin/assets`

| Query | Type | Notes |
| --- | --- | --- |
| `site_id` | int, default 1 | |
| `asset_type` | `site`, `building`, `solar`, `wind`, `battery`, `load`, `grid` or `meter` | Optional filter; any other value returns `422` |
| `status` | string | Optional exact match on `operational_status` |

Each item is an `AssetTwinResponse`: `asset_id`, `name`, `asset_type`, `site_id`, `rated_capacity_kw`, `operational_status`, `telemetry_quality`, `active_power_kw`, `energy_kwh`, `soc_percent`, `health_percent`, `temperature_celsius`, `wind_speed_ms`, `voltage_v`, `frequency_hz`, `observed_at`, `received_at`, `age_seconds` and `raw_metrics`.

### `GET /api/v1/twin/live?site_id=1`

The main dashboard payload:

```json
{
  "site": { "id": 1, "name": "Prestige University, Indore (Malwa Microgrid)", "timezone": "Asia/Kolkata", "jurisdiction": "Madhya Pradesh, India", "currency": "INR", "config_version": 1, "total_assets": 9 },
  "aggregate": {
    "site_id": 1,
    "captured_at": "...",
    "total_solar_kw": 0.0,
    "total_wind_kw": 0.0,
    "total_generation_kw": 0.0,
    "total_building_demand_kw": 0.0,
    "total_battery_charge_kw": 0.0,
    "total_battery_discharge_kw": 0.0,
    "net_battery_kw": 0.0,
    "grid_import_kw": 0.0,
    "grid_export_kw": 0.0,
    "net_grid_flow_kw": 0.0,
    "average_battery_soc_percent": 75.0,
    "online_assets_count": 9,
    "stale_assets_count": 0,
    "degraded_assets_count": 0,
    "offline_assets_count": 0,
    "overall_quality": "good",
    "data_freshness_age_seconds": 1.2
  },
  "assets": [ /* AssetTwinResponse[] */ ]
}
```

The numbers above are placeholders that show the shape; real values depend on the ML stream and the seed. The aggregate is computed by `DigitalTwinStore.compute_campus_aggregates` in `backend/services/digital_twin_store.py`.

### `GET /api/v1/telemetry/series`

| Query | Required | Default |
| --- | --- | --- |
| `asset_id` | yes | |
| `metric_name` | yes | e.g. `active_power_kw` (the only metric the ML stream writes) |
| `start_time` | no | `end_time - 24h` |
| `end_time` | no | now |
| `limit` | no | 1000 (range 1–5000) |

Returns `{ asset_id, metric_name, count, points: [{ observed_at, value, unit, quality, source_adapter }] }`, sorted by time ascending.

### ML twin routes (no authentication)

These routes delegate to `ml_sync_service` (`backend/services/ml_microgrid_sync.py`). The `/api/v1/forecast/...` variants in §9 do the same thing for site 1.

| Route | Query params | Effect |
| --- | --- | --- |
| `POST /twin/reset-to-zero` | `site_id` | Writes `active_power_kw = 0` to every asset state and inserts telemetry points. Returns a per-asset summary. Raises `ValueError` (→ 500) if the site has no assets. |
| `POST /twin/apply-ml-prediction` | `site_id`, `region_id` (default `central_india_mp_indore`), `simulate_daylight_peak` (default `true`) | Runs `ml_forecaster.predict_realtime_point`, writes setpoints to asset states, runs one decision cycle, and returns the prediction details. Its WebSocket broadcast always fails silently because of undefined variables (see [limitations-and-roadmap.md](limitations-and-roadmap.md)). |
| `GET /twin/ml-comparison` | `site_id`, `region_id` | Side-by-side zero-baseline vs. ML values per asset |
| `POST /twin/fluctuate-step` | `site_id`, `region_id` | Gets live weather, samples a stochastic step around the ML P50, writes states and telemetry, and broadcasts `twin_update` |
| `POST /twin/fluctuate-stream/start` | `site_id`, `interval_seconds` (default 2.0, **no lower bound**), `region_id` | Starts the background loop if it is not already running; returns `{status: "started" or "already_running", ...}` |
| `POST /twin/fluctuate-stream/stop` | | Stops the loop |
| `GET /twin/fluctuate-stream/status` | | `{ is_streaming, step_count, last_state, last_event_description }` |

The application lifespan already starts this stream at a 3.0 s interval for site 1, so `start` normally returns `already_running`.

---

## 6. Decisions

### `GET /api/v1/decisions`

| Query | Type | Default / rules |
| --- | --- | --- |
| `site_id` | int | 1 |
| `limit` | int | 50 (1–200) |
| `offset` | int | 0 (≥ 0) |
| `decision_type` | `dispatch`, `battery`, `vnm_allocation`, `load_shift` or `reliability` | optional |
| `from_dt`, `to_dt` | ISO datetime | optional |

Returns `DecisionLogRead[]`: `id`, `cycle_id`, `site_id`, `target_asset_id`, `decision_type`, `action`, `setpoint_kw`, `allocated_kwh`, `allocated_value_inr`, `actor`, `reason`, `confidence`, `expected_savings_inr`, `carbon_impact_kg`, `context_data`, `created_at` and `commands[]`.

### `GET /api/v1/decisions/latest?site_id=1`

Returns a `DecisionCycleRead`: `id`, `site_id`, `status`, `input_snapshot_hash`, `cycle_started_at`, `cycle_completed_at`, `duration_ms`, `health_summary`, `reason`, `decisions[]` and `alternatives[]`. Each alternative has `candidate_id`, `strategy_description`, `score`, `cost_component`, `carbon_component`, `is_selected` and `rejected_reason`. Returns `404 CYCLE_NOT_FOUND` if no cycle exists.

### `GET /api/v1/decisions/stats`

Query: `site_id`, `from_dt`, `to_dt`. Returns:

```json
{
  "site_id": 1,
  "total_decisions": 865,
  "total_savings_inr": 1234.5,
  "total_carbon_reduction_kg": 456.7,
  "by_type": { "dispatch": { "count": 865, "...": "..." } }
}
```

`by_type` holds, per decision type, the count and the sums of `allocated_kwh`, `expected_savings_inr` and `carbon_impact_kg` (see `DecisionRepository.get_decision_stats`).

### `GET /api/v1/decisions/{decision_id}`

Returns one `DecisionLogRead` with its control commands, or `404 DECISION_NOT_FOUND`.

---

## 7. Control

### `POST /api/v1/control/force-cycle` (Operator+)

Body: `{ "site_id": 1 }` (optional; the default is 1). Rate-limited to 10 per minute.

```json
{ "cycle_id": "…", "site_id": 1, "status": "degraded", "duration_ms": 38.2, "decisions_count": 1, "commands_count": 0 }
```

- Runs through the global scheduler, so it respects the emergency-stop flag and the cycle lock.
- **Errors:** `409 CYCLE_LOCKED` if a cycle is already running, plus `401`, `403` and `429`.

### `POST /api/v1/control/commands/{command_id}/acknowledge` (Operator+)

| Field | Type | Notes |
| --- | --- | --- |
| `status` | string, default `executed` | Must be a `CommandStatus` value (`pending`, `accepted`, `rejected`, `timeout`, `failed`, `executed`). The body schema does not validate this, so an invalid value causes `500 INTERNAL_SERVER_ERROR` rather than `422`. |
| `adapter_response` | object | optional |
| `reason` | string | optional |

Returns `ControlCommandRead` and writes an `audit_events` row (`COMMAND_ACKNOWLEDGE`). Returns `404 COMMAND_NOT_FOUND` for an unknown command. In the running application, commands are rarely created (see [workflows.md](workflows.md#decision-cycle)).

### `POST /api/v1/control/emergency-stop` (Admin)

Body:

```json
{ "active": true, "reason": "Transformer maintenance on feeder A" }
```

`reason` must be 3–255 characters. The route sets the in-memory scheduler flag, writes an audit event (`ENGAGE_EMERGENCY_STOP` or `RELEASE_EMERGENCY_STOP`), and returns `{ emergency_stop_active, message, timestamp }`.

- **Scope:** the flag lives in process memory. It resets on restart and is not shared between Uvicorn workers.
- **Not covered:** the ML stream's own periodic decision cycles do not check this flag.

---

## 8. Settings

Every `PUT` and `POST` here is **Admin only** and writes an `audit_events` row with the old and new values. `GET` routes are Viewer+.

| Resource | Update body fields (all optional unless noted) | Validation |
| --- | --- | --- |
| Alert threshold `PUT /alert-thresholds/{id}` | `threshold_value` (float), `severity` (`critical`/`warning`/`info`), `is_active` (bool) | An invalid severity raises `ValueError` → 500 |
| Building config `PUT /building-tiers/{building_id}` | `criticality_tier` (`critical`/`essential`/`non_critical`), `flexible_load_policy` (string), `peak_load_kw` (float) | `building_id` may be the numeric row ID or the asset ID (e.g. `bldg-eng`) |
| VNM rule `POST /vnm-sharing-rules` | `building_asset_id` (**required**), `sharing_ratio` (**required**, 0–1), `jurisdiction` (default `IN-KA`) | Returns `201` |
| VNM rule `PUT /vnm-sharing-rules/{rule_id}` | `sharing_ratio` (0–1), `effective_until` (datetime) | Changing the ratio increments `rule_version` |
| Battery `PUT /assets/{asset_id}/battery` | `min_soc`, `max_soc`, `reserve_floor`, `max_charge_power_kw`, `max_discharge_power_kw`, `round_trip_efficiency`, `health_floor` | No range or consistency checks |
| Control policy `PUT /control-policy` | `closed_loop_enabled`, `emergency_stop_active`, `cost_weight`, `carbon_weight` | Weights are **not** checked to sum to 1 |

`GET /control-policy` returns `{ closed_loop_enabled, emergency_stop_active, cost_weight, carbon_weight, decision_cycle_seconds }`.

`PUT /control-policy` changes **in-memory** state only: the scheduler flags and the cached `Settings` object. The changes are lost on restart and apply only to the worker process that handled the request.

---

## 9. Export

All three routes take `site_id`, `from_dt` and `to_dt`, and are Viewer+.

| Route | Response |
| --- | --- |
| `GET /api/v1/export/csv` | `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="surya_report_site_<id>_<YYYYmmdd_HHMMSS>.csv"`, header `X-Report-Site-Id` |
| `GET /api/v1/export/pdf` | `application/pdf` (generated with ReportLab), same headers with `.pdf` |
| `GET /api/v1/export/stats` | JSON `ExportStatsResponse`: `site_id`, `period_start`, `period_end`, `timezone`, `currency`, `units`, `tariffs`, `metrics`, `data_quality_disclosure` |

```bash
curl -H "Authorization: Bearer $TOKEN" -OJ "http://127.0.0.1:8000/api/v1/export/pdf?site_id=1"
```

---

## 10. Forecasting and ML (`/api/v1/forecast`)

All routes here are **public**. Model files are loaded from a hard-coded local Windows path. When they are missing (on any machine other than the original developer's, including Render), the forecaster uses placeholder `DummyQuantileModel` objects and generated default metrics. See [ml-and-forecasting.md](ml-and-forecasting.md).

| Route | Params / body | Response |
| --- | --- | --- |
| `GET /regions` | | `RegionInfo[]`: `{ id, name, grid_emission_factor }` |
| `GET /48h` | `region_id` (default `central_india_mp_indore`) | `ForecastResponse`: hourly baseline vs. ML P10/P50/P90 points, alerts, available regions, grid implications |
| `GET /metrics` | | Evaluation metrics (`metrics["results"]`) |
| `POST /reload` | | `{ status: "ok", ready, models_count }` |
| `POST /train-region` | JSON `TrainRegionRequest`: `region_id`, `name`, `lat`, `lon`, `solar_pv_capacity_kw` (>0), `wind_capacity_kw` (>0), `grid_emission_factor` (default 0.74), `custom_file_path` (optional, **server-side file path**) | `{ status, message, report }`. Runs synchronously in the request (downloads weather, trains models). Failures return `500` with a string detail. |
| `GET /site-metrics` | | The contents of a JSON file at a hard-coded local path, or `{ "message": "Site-level models not yet serialized." }` |
| `POST /reset-to-zero` | | See §5 |
| `POST /apply-prediction` | Optional JSON: `region_id`, `simulate_daylight_peak`, `ghi_wm2`, `wind_speed_mps`, `temp_c`, `cloud_pct` | See §5. Custom weather values override the live weather. |
| `GET /live-comparison` | `region_id` | See §5 |
| `POST /fluctuate-step` | `region_id` | See §5 |
| `POST /fluctuate-stream/start` | `interval_seconds` (default 3.0), `region_id` | See §5 |
| `POST /fluctuate-stream/stop`, `GET /fluctuate-stream/status` | | See §5 |
| `GET /weather-live` | `region_id` | `{ region_id, weather, physics_baseline: { solar_physics_kw, wind_physics_kw, total_generation_kw }, streaming_status }` |

Region IDs defined in `REGIONAL_COORDINATES` (`backend/services/agnitia_ml_forecaster.py`) are `central_india_mp_indore`, `western_india_gujarat`, `southern_india_tamil_nadu`, `northern_india_rajasthan` and `all_india_grid`. An unknown `region_id` falls back to the Indore coordinates for weather.

`weather-live` and the fluctuation routes call the Open-Meteo API (`api.open-meteo.com`) with a 5 s timeout and a 60 s per-region cache. If the call fails, they use the last cached value or a time-of-day solar fallback (`"is_live_api": false`).

---

## 11. WebSocket: `/ws`

```text
ws://<host>/ws?token=<access_token>
```

- **Authentication:** the token is decoded with the JWT secret. If it is missing, invalid or expired, the server closes the connection with code `1008` (policy violation) before accepting it. The check does **not** look at `token_version` or `is_active`, so a token revoked by logout can still open a socket until it expires.
- **Client → server:** the text `ping` gets the text reply `pong`. Other messages are ignored.
- **Server → client:** JSON envelopes (`WebSocketEnvelope` in `backend/ws/websocket_manager.py`):

```json
{
  "version": 1,
  "type": "twin_update",
  "message_id": "uuid",
  "sent_at": "2026-10-09T10:15:02.118Z",
  "request_id": null,
  "data": { }
}
```

| `type` | Emitted by | `data` |
| --- | --- | --- |
| `twin_update` | `ml_sync_service.generate_live_fluctuation_step` (every stream step, about every 3 s) | `{ id, site_id, name, aggregates{...}, assets[...], fluctuation{...}, weather{...}, physics_baseline{...}, timestamp, ... }` |
| `full_cycle` | `DecisionScheduler.execute_cycle` (every `DECISION_CYCLE_SECONDS`), and the ML stream every eighth step | `{ id, cycle_id, site_id, status, duration_ms, cycle_started_at, decisions_count, commands_count, decisions[] }` |

The envelope schema documents `alert`, `health` and `error` types as well, but **no backend code emits them**.

Broadcasts go to the clients connected to the same process only. With more than one Uvicorn worker, a client sees only events produced in its own worker.
