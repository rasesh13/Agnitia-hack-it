# Dependencies

Versions are the constraints declared in the manifests. Where an installed version was observed during the audit, it is noted.

Related: [installation-and-setup.md](installation-and-setup.md) · [troubleshooting.md](troubleshooting.md#maintenance)

---

## 1. Backend (`requirements.txt`, the authoritative install list)

| Package | Constraint | Used for |
| --- | --- | --- |
| fastapi | ≥ 0.110.0 | Web framework, OpenAPI |
| uvicorn[standard] | ≥ 0.28.0 | ASGI server |
| pydantic[email] | ≥ 2.6.0 | Schemas, `EmailStr` |
| pydantic-settings | ≥ 2.2.1 | `Settings` |
| sqlalchemy[asyncio] | ≥ 2.0.28 | ORM |
| alembic | ≥ 1.13.1 | Migrations |
| aiosqlite | ≥ 0.20.0 | SQLite async driver (development and tests) |
| asyncpg | ≥ 0.29.0 | Postgres async driver |
| psycopg2-binary | ≥ 2.9.9 | Not imported by the code (possibly for tooling) |
| argon2-cffi | ≥ 23.1.0 | Password hashing |
| pyjwt[crypto] | ≥ 2.8.0 | HS256 tokens, RS256 Google JWKS |
| python-multipart | ≥ 0.0.9 | Installed; no form or upload endpoints use it |
| httpx | ≥ 0.27.0 | REST adapter; test client |
| websockets | ≥ 12.0 | WebSocket support for Uvicorn |
| reportlab | ≥ 4.1.0 | PDF export |
| numpy, pandas, scikit-learn, lightgbm, xgboost, joblib | ≥ 1.26 / 2.2 / 1.4 / 4.3 / 2.0 / 1.3 | ML inference (imported at startup) and training |
| pytest, pytest-asyncio, ruff | ≥ 8.0 / 0.23.5 / 0.3.0 | Development tooling, also installed in production images |

`pyproject.toml` (project `surya` 0.1.0, `requires-python >=3.11`) lists a **subset**: it omits the ML packages, `psycopg2-binary` and the `[email]` extra. Use `requirements.txt`. Only lower bounds are pinned, so builds are not reproducible over time.

## 2. Web console (`frontend/package.json`, lockfile committed)

| Runtime | Version | Use |
| --- | --- | --- |
| react, react-dom | ^18.2.0 | UI |
| framer-motion | ^14.0.0 | Landing hero animation |
| gsap, @gsap/react | ^3.15.0 / ^2.1.2 | Landing scroll animations |
| lenis | ^1.3.26 | Landing smooth scroll |
| lucide-react | ^0.359.0 | Icons |
| clsx | ^2.1.0 | Class names |
| tailwind-merge | ^2.2.1 | **Unused** |
| @fontsource-variable/outfit | ^5.3.0 | Display font |

Dev dependencies: vite ^5.1.6 (5.4.21 installed), @vitejs/plugin-react, typescript ^5.2.2, tailwindcss ^3.4.1, postcss, autoprefixer, eslint ^8.57 with @typescript-eslint ^7.2 and the react-hooks and react-refresh plugins.

## 3. Simulator (`simulator/package.json`)

react and react-dom ^19.2.0, three ^0.181.1, @react-three/fiber ^9.4.0, @react-three/drei ^10.7.6, lucide-react ^0.468.0. Dev: vite ^8.2.1, @vitejs/plugin-react ^6.0.5.

## 4. Mobile (`mobile/package.json`)

- **Runtime:** @capacitor/core and android ^8.5.3, plus the plugins app, background-runner ^3.0.0, haptics, local-notifications, preferences, splash-screen and status-bar; react and react-dom ^19.2.8; lucide-react.
- **Dev:** vite ^8.3.0, typescript ~6.0.2, oxlint, @capacitor/cli, @capacitor/assets.

## 5. External services

| Service | Used by | Purpose | Auth |
| --- | --- | --- | --- |
| Open-Meteo forecast API (`api.open-meteo.com/v1/forecast`) | Backend forecaster; simulator (fallback) | Current weather | None |
| Open-Meteo archive API | `training/step3`, `step5` | Historical weather for training | None |
| Google Identity Services / JWKS | Console (GSI script), backend | Sign-in | OAuth client ID |
| wttr.in | Simulator | Current weather (primary) | None |
| Render, Vercel | Hosting | | Platform accounts |

None of these are under the project's control. The backend and simulator both fall back to modelled weather when a service is unreachable.
