# Installation and Local Setup

These steps set up the project on a clean machine. Commands come from the repository's scripts and configuration. Steps that this audit actually executed are marked ✅; the rest come from the repository but were not run end to end during the audit.

Related: [environment-configuration.md](environment-configuration.md) · [troubleshooting.md](troubleshooting.md) · [testing.md](testing.md)

---

## 1. Prerequisites

| Tool | Version guidance | Evidence |
| --- | --- | --- |
| Python | 3.11 or 3.12 recommended | `pyproject.toml` `requires-python >=3.11`; Docker uses 3.11; Render uses 3.12.8. A 3.13 virtualenv exists locally but was missing the ML packages, so 3.13 compatibility of LightGBM/XGBoost was not verified. |
| Node.js | 22.x recommended | The simulator uses Vite 8 and the mobile app Vite 8, which need a recent Node; the frontend Dockerfile uses Node 22 for the simulator stage and 20 for the app stage. No `engines` field is declared. |
| npm | Bundled with Node | `package-lock.json` in `frontend/`, `simulator/`, `mobile/` |
| Git | any | |
| Optional: PostgreSQL 16 | For production-like runs | `docker-compose.yml` |
| Optional: Docker + Compose | For the containerised stack | `docker-compose.yml` |
| Optional: JDK 21 + Android SDK 36 | For building the APK | `mobile/README.md` |

## 2. Clone

```bash
git clone https://github.com/rasesh13/Agnitia-hack-it.git
cd Agnitia-hack-it
```

## 3. Backend

```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell
.venv\Scripts\Activate.ps1

pip install -r requirements.txt       # includes pandas, lightgbm, xgboost (needed: the app imports them at startup)
cp .env.example .env                  # then edit JWT_SECRET_KEY, CORS_ORIGINS
```

> Install from `requirements.txt`, not `pip install -e .`. The `pyproject.toml` dependency list omits pandas, scikit-learn, LightGBM, XGBoost and `psycopg2`, and the application cannot import without pandas.

### Database

- **SQLite (default):** with `ENVIRONMENT=development`, the app creates the tables and seeds the Prestige University demo on first start. No migration step is needed. The file `surya_dev.db` is created in the working directory.
- **PostgreSQL:** set `DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DB`, then run:

  ```bash
  alembic upgrade head
  ```

  With `ENVIRONMENT=development` the app also runs `create_all`. In other environments only Alembic creates tables, and you need `SEED_DEMO_DATA=true` to get demo data.

### Run

Run from the **repository root**. The app imports `training/` as a package and reads `.env` from the working directory.

```bash
uvicorn backend.main:app --reload --port 8000
```

Check that it is up:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/ready
# Swagger UI: http://127.0.0.1:8000/docs
```

On startup the decision scheduler and the ML fluctuation stream begin immediately. The stream calls Open-Meteo, and it falls back to a model when offline.

## 4. Web console

```bash
cd frontend
npm ci
npm run build:simulator   # optional: builds ../simulator into public/simulator (needed for the Digital Twin 3D view)
npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to `http://127.0.0.1:8000` by default, so no CORS setup is needed in this mode.

- **Backend on another port:** start Vite with `VITE_API_URL=http://127.0.0.1:<port>` and `VITE_WS_URL=ws://127.0.0.1:<port>`. Setting `VITE_API_URL` also makes the browser call the backend **directly**, so you must add the console origin (e.g. `http://localhost:5173`) to the backend's `CORS_ORIGINS`.
- **Signing in locally:** with the development seed you can create an account with Sign up (it gets the `viewer` role), or use the demo admin login on the Login page. See the security note in [authentication-and-authorization.md](authentication-and-authorization.md#4-demo-accounts).

## 5. Simulator (standalone)

```bash
cd simulator
npm ci
npm run dev     # http://127.0.0.1:5173/#prestige-university  (conflicts with the console's 5173 if both run; Vite picks the next free port)
npm test
```

## 6. Android app

See [mobile-app.md](mobile-app.md) and `mobile/README.md`. The phone must reach the backend over the network:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8010
```

## 7. Production builds

```bash
npm --prefix frontend run build:simulator && npm --prefix frontend run build   # ✅ build verified (frontend part)
docker compose up --build -d                                                     # containerised stack, see deployment.md
```

## 8. Tests and quality checks

```bash
python -m pytest            # backend tests (needs requirements.txt installed)
python -m ruff check backend tests
npm --prefix frontend run lint
npm --prefix simulator test
```

Actual results from this audit are in [testing.md](testing.md).

## 9. Resetting local state

- Stop the server and delete `surya_dev.db`. It is recreated and reseeded at the next development startup.
- **Do not** run `backend/scripts/seed_dev.py` against a database you care about: it drops all tables.
