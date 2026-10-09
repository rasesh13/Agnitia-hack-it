# Troubleshooting and Maintenance

Each entry gives symptoms, cause, diagnosis and fix. Entries marked **(confirmed)** are reproducible project-specific behaviours found in the code or during this audit. Others are labelled **(potential)**.

Related: [installation-and-setup.md](installation-and-setup.md) · [deployment.md](deployment.md) · [environment-configuration.md](environment-configuration.md)

---

## Backend

### `ModuleNotFoundError: No module named 'pandas'` (or `lightgbm` / `xgboost`) at startup or in tests (confirmed)

- **Cause:** `backend/main.py` imports `routes_forecast`, which imports `agnitia_ml_forecaster`, which imports pandas, joblib and the ML libraries. These are listed in `requirements.txt` but not in `pyproject.toml`.
- **Fix:** `pip install -r requirements.txt` into the active virtualenv.

### `ModuleNotFoundError: No module named 'training'` (confirmed in Docker; potential elsewhere)

- **Cause:** `routes_forecast.py` imports `training.step5_test_and_train_custom_region`.
  - In Docker, `backend/Dockerfile` does not copy `training/`.
  - Locally, the server was started from a directory other than the repository root.
- **Fix:** run Uvicorn from the repository root. For Docker, add `COPY training /app/training`.

### Startup fails with a `ValueError` from `Settings` (confirmed behaviour)

- **Symptoms:** messages such as `COST_WEIGHT (...) + CARBON_WEIGHT (...) must sum to 1.0`, or `In production, JWT_SECRET_KEY must be a secure random string of at least 32 characters`.
- **Diagnosis:** check the `.env` in the **working directory** and the process environment. Names are case-sensitive.
- **Fix:** correct the values; see the validation rules in [backend.md §4](backend.md#4-configuration).

### Port already in use (potential)

- **Symptom:** `[Errno 10048]` / `address already in use`.
- **Fix:** start on another port (`uvicorn ... --port 8010`) and point the console at it with `VITE_API_URL`/`VITE_WS_URL`. Update `CORS_ORIGINS` too, because the browser then calls the backend directly.

### Sign-in "does nothing" or shows a network error from the console (potential, common)

- **Cause:** a CORS rejection. This happens when `VITE_API_URL` points to a different origin that is not in `CORS_ORIGINS`.
- **Diagnosis:** the browser console shows `blocked by CORS policy`; the preflight `OPTIONS` request gets no `Access-Control-Allow-Origin`.
- **Fix:** add the exact console origin (scheme, host and port) to `CORS_ORIGINS` and restart the backend.

### Login returns 401 `INVALID_CREDENTIALS` for a demo account (potential)

- **Cause:** the database was not seeded. This happens when `ENVIRONMENT` is not `development`/`test` and `SEED_DEMO_DATA` is not true, or when you are pointing at a different backend or database than expected.
- **Diagnosis:** `GET /api/v1/twin/site?site_id=1` (with any valid token) returns 404 `SITE_NOT_FOUND`.
- **Fix:** set `SEED_DEMO_DATA=true` (development seeds automatically), or sign up.

### 429 `RATE_LIMIT_EXCEEDED` (confirmed behaviour)

Login allows 15 requests/minute per IP, signup and Google 10, force-cycle 10. Wait for `details.retry_after_seconds`. Counters reset on restart.

### `/api/v1/auth/google` returns 503 (confirmed behaviour)

`GOOGLE_CLIENT_ID` is not set on the backend. Set it to the same client ID as the frontend's `VITE_GOOGLE_CLIENT_ID`, and add the console origin to the OAuth client's authorised JavaScript origins in Google Cloud Console.

### `/health/ready` returns 503 `DATABASE_UNAVAILABLE` (potential)

- **Fix:** check `DATABASE_URL`, network access and credentials. The driver error is included in `details`.
- **Render:** URLs that start with `postgres://` are converted automatically.

### Tables missing in Postgres (`relation "users" does not exist`) (potential)

Outside development the app does not create tables. Run `alembic upgrade head`; Render's start command already does this.

### Decision cycles always `degraded` (confirmed behaviour)

A cycle is marked degraded when the forecast is degraded, overall telemetry quality is not `good`, or any asset is stale. Inspect `health_summary` in `GET /api/v1/decisions/latest`. `"adapter": "stale"` is expected, because no hardware adapter or snapshot provider is wired.

### Forecast metrics look "too round", or `models_count` is 18 with no model files (confirmed)

The model directory is hard-coded to `D:\codes\model files for agnitia hack it`. Without it, dummy models and generated metrics are used. See [ml-and-forecasting.md](ml-and-forecasting.md).

### The database keeps growing (confirmed)

The ML stream and scheduler insert rows continuously and nothing purges them. Locally, delete `surya_dev.db`. In production, purge old `telemetry_points`, `decision_alternatives`, `decision_logs` and `decision_cycles` manually, or implement retention ([limitations-and-roadmap.md](limitations-and-roadmap.md)).

### Emergency stop seems to "reset" (confirmed)

The E-stop flag lives in memory. It is lost on restart or redeploy, including Render free-plan sleep, and with several workers it applies to only one of them.

## Web console

### Page shows plausible data but nothing changes (confirmed behaviour)

Several pages render hard-coded fallback data when API calls fail ([frontend.md](frontend.md#fallback-and-mock-data)). Open the browser's network tab and look for failing `/api/v1/...` requests.

### WebSocket pill shows "Reconnecting" / "Offline" (potential)

- **Checks:**
  - The backend is running.
  - The token is valid (the socket closes with code 1008 if not).
  - In development, `VITE_WS_URL` or `VITE_API_URL` points at the right port.
  - Behind nginx, `/ws` must be proxied with the `Upgrade` headers (already done in `nginx/nginx.conf`).
- **Render:** free instances may be asleep.

### Forecast page shows data that never matches the backend, on Vercel (confirmed)

`Forecast.tsx` and `Overview.tsx` use a relative `/api/v1/forecast/48h` URL that Vercel rewrites to `index.html`. Fix the code to use the API base URL.

### CSV/PDF download opens a JSON `AUTH_REQUIRED` error (confirmed)

The download link passes `?token=`, which the backend ignores. Until this is fixed, download with curl:

```bash
curl -H "Authorization: Bearer $TOKEN" -OJ "https://<backend>/api/v1/export/csv?site_id=1"
```

### Asset details modal shows no telemetry (confirmed)

It calls a route that does not exist (`/api/v1/twin/assets/{id}/telemetry`). The working route is `/api/v1/telemetry/series?asset_id=...&metric_name=active_power_kw`.

### Digital Twin tab shows a blank iframe or 404 (confirmed cause)

`frontend/public/simulator/` is git-ignored and has to be built. Run `npm --prefix frontend run build:simulator`.

### `npm ci` fails in `simulator/` or `mobile/` with engine errors (potential)

Vite 8 needs a recent Node. Use Node 22.

### Build warns "Some chunks are larger than 500 kB" (confirmed, harmless)

The console bundle is about 717 kB. This is a warning only.

## Mobile app

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "Test connection" fails | Backend bound to `127.0.0.1`, phone on a different network, or campus Wi-Fi client isolation | Run `uvicorn --host 0.0.0.0`; use a phone hotspot; check the firewall |
| Signed out with "session expired" | JWT expired (120 min) or revoked | Sign in again |
| Background alerts are slow | Android WorkManager minimum of 15 minutes | Expected behaviour |

Build problems such as JDK version and R8 keep rules are covered in `mobile/README.md`.

## Maintenance

- **Dependency updates:**
  - Backend: `requirements.txt` uses only `>=` lower bounds, so fresh installs pick up new major versions. Consider generating a lock file (for example with `pip-compile`).
  - Frontend, simulator, mobile: use `npm ci` with the committed lockfiles. Update with `npm update` or `npm install <pkg>@<version>` and commit the lockfile.
  - After any update, run the test and quality commands in [testing.md](testing.md).
- **Schema changes:** always add an Alembic revision. Development uses `create_all` and will hide missing migrations.
- **Areas that need care:**
  - `ml_microgrid_sync.py`: it writes to the database every 3 s and has a known `NameError` path.
  - The scheduler and E-stop logic.
  - The auth routes.
  - `backend/scripts/seed_dev.py`: it drops tables.
