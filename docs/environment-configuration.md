# Environment Configuration

Every variable below was found in source or configuration. Backend variables are fields of `Settings` in `backend/config.py`. They are read from the process environment and from a `.env` file in the **current working directory**, and names are case-sensitive. Frontend variables are Vite build-time variables. Never commit real values; `.env` is git-ignored, and `.env.example` holds placeholders.

Related: [installation-and-setup.md](installation-and-setup.md) · [deployment.md](deployment.md)

---

## 1. Backend: variables that affect runtime behaviour

| Variable | Purpose | Required? | Example format | Default (verified) |
| --- | --- | --- | --- | --- |
| `ENVIRONMENT` | `development`/`test` create tables and seed at startup; `production` enables the strict checks | No | `production` | `development` |
| `DATABASE_URL` | Async SQLAlchemy URL. `postgres://` is rewritten to `postgresql+asyncpg://`. | Yes in production | `postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME` | `sqlite+aiosqlite:///./surya_dev.db` |
| `JWT_SECRET_KEY` | HS256 signing key | Yes in production (≥ 32 chars, not a known default) | random string of 32+ characters | an insecure development placeholder |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | No | `120` | `120` |
| `CORS_ORIGINS` | Allowed browser origins: comma-separated or a JSON list. `*` is forbidden in production. | Yes when the console runs on another origin | `https://console.example.com,http://localhost:5173` | `http://localhost:5173, http://localhost:3000, http://127.0.0.1:5173` |
| `GOOGLE_CLIENT_ID` | Enables `POST /auth/google`; expected `aud` claim | No (Google login returns 503 without it) | `<id>.apps.googleusercontent.com` | unset |
| `SEED_DEMO_DATA` | Seed the demo microgrid and **admin demo accounts** outside development | No | `true` | `false` |
| `DECISION_CYCLE_SECONDS` | Scheduler cadence; also reported by `/settings/control-policy` | No | `10` | `10` |
| `COST_WEIGHT`, `CARBON_WEIGHT` | Dispatch scoring weights; must sum to 1.0 | No | `0.6`, `0.4` | `0.6`, `0.4` |

## 2. Backend: validated at startup but not otherwise used

These are declared and validated in `Settings`, and listed in `.env.example`, but **no runtime code reads them**, as of commit `243b65c`. Setting them has no effect beyond startup validation.

| Variable | Default | Note |
| --- | --- | --- |
| `BACKEND_HOST`, `BACKEND_PORT` | `0.0.0.0`, `8000` | Uvicorn's `--host`/`--port` flags decide the bind address |
| `SCHEDULER_ENABLED` | `true` | Reported by `/health/ready`, but the scheduler always starts |
| `CLOSED_LOOP_CONTROL_ENABLED` | `false` | The scheduler always starts with closed loop off; change it through `PUT /settings/control-policy` |
| `TELEMETRY_POLL_INTERVAL_SECONDS`, `TELEMETRY_STALE_AFTER_SECONDS`, `TELEMETRY_FAILURE_AFTER_SECONDS` | `5`, `30`, `60` | Must satisfy poll < stale < failure |
| `GRID_EMISSION_FACTOR_KG_PER_KWH` | `0.716` | The optimisers use their own default of 0.82 |
| `ALERT_LOW_BATTERY_SOC`, `ALERT_CRITICAL_BATTERY_SOC`, `ALERT_HIGH_GRID_IMPORT_KW`, `ALERT_RESERVE_FLOOR_PERCENT`, `ALERT_DATA_STALENESS_SECONDS` | `25`, `15`, `450`, `20`, `30` | Critical < low; reserve floor ≥ `BATTERY_MIN_SOC` |
| `BATTERY_MIN_SOC`, `BATTERY_MAX_SOC`, `BATTERY_MAX_CHARGE_RATE_KW`, `BATTERY_MAX_DISCHARGE_RATE_KW`, `BATTERY_HEALTH_FLOOR` | `10`, `95`, `200`, `200`, `70` | Min < max. Per-battery limits come from the `battery_configs` table. |
| `GRID_IMPORT_TARIFF_PER_KWH`, `GRID_EXPORT_TARIFF_PER_KWH` | `8.50`, `3.50` | The decision manager uses its own defaults of 9.50 and 3.50 |
| `CURRENCY`, `SITE_TIMEZONE` | `INR`, `Asia/Kolkata` | |
| `ADAPTER_TYPE`, `ADAPTER_HOST`, `ADAPTER_PORT`, `ADAPTER_POLL_TIMEOUT_SECONDS` | `rest`, `localhost`, `8080`, `5` | In production, `ADAPTER_TYPE` must not be a stub/mock/test value. Adapters are not wired. |
| `TELEMETRY_RETENTION_DAYS`, `DECISION_AUDIT_RETENTION_DAYS` | `90`, `365` | No purge job exists |

## 3. Variables set in deployment files but not read by the backend

| Variable | Where it is set | Note |
| --- | --- | --- |
| `JWT_ALGORITHM`, `DEFAULT_SITE_ID`, `CLOSED_LOOP_ENABLED` | `docker-compose.yml` | Ignored (`extra="ignore"`). `CLOSED_LOOP_ENABLED` is probably meant to be `CLOSED_LOOP_CONTROL_ENABLED`, which is itself unused. |
| `PYTHON_VERSION` | `render.yaml` | Read by Render, not by the app (`3.12.8`) |
| `WORKERS` | `backend/entrypoint.sh` | Uvicorn worker count; defaults to **4**. Set it to `1` (see [architecture.md §9](architecture.md#process-model-constraint)). |
| `PORT` | Render | Passed to `uvicorn --port $PORT` |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `docker-compose.yml` | Postgres container and the composed `DATABASE_URL`. The defaults are insecure placeholders; override them. |

## 4. Frontend (Vite, build time)

Vite embeds `VITE_*` variables at **build time**. Change them in the hosting provider, then rebuild.

| Variable | Read in | Purpose | Required? | Example format | Default |
| --- | --- | --- | --- | --- | --- |
| `VITE_API_URL` | `src/services/api.ts`, `src/context/WebSocketContext.tsx`, `vite.config.ts` (dev proxy target) | Backend base URL for REST and the WebSocket | Yes when the backend is on another origin (Vercel → Render) | `https://<backend-host>` | `''` (same origin); dev proxy target `http://127.0.0.1:8000` |
| `VITE_WS_URL` | `vite.config.ts` only | Dev-proxy target for `/ws` | No | `ws://127.0.0.1:8000` | `ws://127.0.0.1:8000` |
| `VITE_GOOGLE_CLIENT_ID` | `src/components/GoogleSignInButton.tsx` | Google Identity Services client ID; must match the backend's `GOOGLE_CLIENT_ID` | No | `<id>.apps.googleusercontent.com` | unset (button shows "not configured") |

There is no `frontend/.env.example`. Create `frontend/.env.local` (git-ignored by `.env*`) for local overrides.

## 5. Mobile app

The mobile app has no environment variables. The server URL is entered at sign-in, with a hard-coded LAN default. Android signing reads `mobile/android/keystore.properties` (keys `storeFile`, `storePassword`, `keyAlias`, `keyPassword`); this file is git-ignored.

## 6. Example `.env` for local development

```dotenv
ENVIRONMENT=development
DATABASE_URL=sqlite+aiosqlite:///./surya_dev.db
JWT_SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(48))">
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# GOOGLE_CLIENT_ID=<optional>
```

Start from `cp .env.example .env`. All values in `.env.example` are placeholders. It does not list `SEED_DEMO_DATA`.
