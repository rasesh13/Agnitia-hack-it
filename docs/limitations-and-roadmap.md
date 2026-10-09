# Limitations, Technical Debt and Roadmap

Status labels:

- **Implemented:** works as described.
- **Partial:** exists but is incomplete or not wired in.
- **Not implemented:** described in `spec.md`, the legacy docs or the UI, but missing.
- **Defect:** verified bug.

Security issues are tracked separately in [security.md](security.md). Everything below was verified against commit `243b65c` on 2026-10-09.

---

## 1. Feature status

| Capability | Status | Evidence / notes |
| --- | --- | --- |
| Email/password and Google authentication, RBAC | Implemented | `routes_auth.py`, `deps.py` |
| Digital twin read API and campus aggregates | Implemented | `routes_twin.py`, `digital_twin_store.py` |
| Decision scheduler and dispatch optimisation with alternatives | Implemented | `scheduler.py`, `dispatch_optimizer.py` |
| Battery scheduling, VNM allocation, load-shift advice | **Partial**: implemented and unit-tested, but never invoked at runtime because no configurations are passed to the cycle | `decision_manager.py`, `scheduler.py` |
| Closed-loop control commands | **Partial**: modelled and storable, but never generated (needs battery configs) and never sent (no adapter) | `control_commands` is empty in the development DB |
| Hardware adapters (REST/Modbus/MQTT) | **Partial**: implemented and tested, but not wired | `backend/adapters/` |
| Telemetry quality evaluation | **Partial**: used only by adapters and tests | `telemetry_quality.py` |
| Live telemetry | Simulation-backed: ML or dummy P50 plus noise from real weather | `ml_microgrid_sync.py` |
| ML forecasting | **Partial**: models load only from a developer's local `D:\` path; deployed instances use dummy models | `agnitia_ml_forecaster.py` |
| Server-side alerting (`alert` WebSocket events, threshold evaluation) | **Not implemented**: thresholds are stored but never evaluated; the mobile app evaluates rules on the device | `routes_settings.py`, `mobile/src/lib/alerts.ts` |
| Data retention and purging | **Not implemented** | settings exist; no job |
| User and role management API | **Not implemented** | |
| Audit log viewer | **Not implemented** (table only) | |
| CSV/PDF export API | Implemented | `export_service.py` |
| CSV/PDF export from the console | **Defect**: 401 | `Reports.tsx` uses `?token=` |
| 3D simulator | Implemented as a standalone visualisation; no data link to the backend | `simulator/` |
| Android companion app | Implemented (LAN HTTP, polling) | `mobile/` |
| CI/CD | **Not implemented** | no `.github/` |
| Frontend tests | **Not implemented** | |

## 2. Verified defects

| # | Defect | Location |
| --- | --- | --- |
| D1 | WebSocket broadcast after `apply_ml_prediction` references undefined names (`solar_total`, `wind_total`, `tot_gen`, `tot_load`, `batt_power`, `grid_power`, `net_balance`, `setpoints`, `assets`). The `NameError` is caught and logged, so clients are never notified. Also flagged as F821 by ruff. | `backend/services/ml_microgrid_sync.py` ~L240–280 |
| D2 | Docker backend image omits `training/`, so the import fails at startup | `backend/Dockerfile`, `routes_forecast.py` |
| D3 | Console export downloads pass the token as a query parameter, giving 401 | `frontend/src/services/api.ts`, `Reports.tsx` |
| D4 | Asset telemetry modal calls the non-existent `/api/v1/twin/assets/{id}/telemetry` | `frontend/src/services/api.ts`, `AssetDetailModal.tsx` |
| D5 | Relative `fetch('/api/v1/forecast/48h')` ignores `VITE_API_URL` and breaks on Vercel | `Overview.tsx`, `Forecast.tsx` |
| D6 | Optimizer "alternatives" always loads the latest cycle | `frontend/src/pages/Optimizer.tsx` |
| D7 | ML stream decision cycles ignore the emergency stop and the scheduler lock | `ml_microgrid_sync.py` |
| D8 | `SCHEDULER_ENABLED` and `CLOSED_LOOP_CONTROL_ENABLED` are ignored | `backend/main.py`, `scheduler.py` |
| D9 | Invalid enum strings (command status, threshold severity) return 500 instead of 422 | `routes_control.py`, `routes_settings.py` |
| D10 | Docker entrypoint defaults to 4 workers, which duplicates schedulers and streams | `backend/entrypoint.sh` |
| D11 | Inconsistent constants: emission factor 0.716 (settings) vs. 0.82 (optimisers, UI, export) vs. 0.74 (ML regions); import tariff 8.50 (settings) vs. 9.50 (decision manager) | various |
| D12 | Migration `server_default`s use lower-case enum values while the ORM stores upper-case names | `001_initial_schema.py` |
| D13 | `pyproject.toml` dependencies are incomplete compared with `requirements.txt` | `pyproject.toml` |

## 3. Technical debt

- **Hard-coded machine paths:** `D:\codes\...` in `agnitia_ml_forecaster.py`, `routes_forecast.py` and every `training/` script.
- **Single-process state:** the E-stop flag, WebSocket hub, rate limiter, ML stream and policy changes all live in process memory.
- **Blocking I/O on the event loop:** the `urllib` weather fetch and synchronous training.
- **Frontend:**
  - Fabricated fallback data on many pages.
  - About 15 unused API functions and the unused `components/landing/` and `components/core/` folders.
  - A single 717 kB bundle.
  - No router.
- **Code quality:** ruff reports 139 issues (mostly line length, plus unused imports and the F821 bug).
- **Documentation drift:** `spec.md`, `PLAN.md`, `simulator/README.md` and the landing-page copy claim "no simulator / zero synthetic data", which contradicts the implementation.

## 4. Recommended roadmap

These are proposals, not commitments. They are ordered by risk reduction.

1. **Security hardening:** fix S1–S5 in [security.md](security.md). Add auth to the ML and forecast routes.
2. **Fix verified defects** D1–D5 and D7.
3. **Make ML deployable:** read the model directory from a setting (e.g. `MODEL_DIR`), ship or download the artifacts, and expose whether real models are loaded in `/health/ready`.
4. **Wire the optimiser completely:** load building, battery and VNM configs from the database in the scheduler. Pass `Settings` tariffs and the emission factor.
5. **Retention job** for `telemetry_points` and the decision tables.
6. **CI:** pytest, ruff, the frontend build and lint, and the simulator tests on every push.
7. **Persist operational state** (E-stop, closed loop, weights) in the database. Then consider a shared broker such as Redis for WebSocket fan-out, so the backend can run more than one worker.
8. **Hardware integration:** construct the adapter from settings and pass snapshots to the scheduler.
9. **Frontend:** use the API base URL everywhere, replace fake fallbacks with error states, add routing and code splitting, and add component and E2E tests.
10. **Server-side alerting:** evaluate `alert_thresholds` in the cycle and emit `alert` WebSocket events.
