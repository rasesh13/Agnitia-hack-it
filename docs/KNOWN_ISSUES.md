# SURYA Platform Known Issues, Security Disclosures & Fix Registry

> **Technical Audit Findings, Lint Warnings, Security Notes, and Prioritized Remediation Backlog**  
> Audit Date: 2026-10-09

---

## 1. Security & Credential Disclosures

Per strict security practices, no raw secrets or passwords are reproduced here. The following locations contain default development or demo credentials that must be rotated in production deployments:

| File Path | Description of Hardcoded Credential | Severity | Remediation |
| :--- | :--- | :--- | :--- |
| [`backend/db/seed_demo_data.py`](../backend/db/seed_demo_data.py) | Hardcoded password strings used to seed default admin and operator demo accounts. | Low (Demo Only) | Replace with dynamic environment variable password injection (`ADMIN_PASSWORD`, `OPERATOR_PASSWORD`). |
| [`backend/scripts/seed_dev.py`](../backend/scripts/seed_dev.py) | Hardcoded dev passwords for `admin@surya-energy.com`, `operator@surya-energy.com`, `viewer@surya-energy.com`. | Low (Dev Only) | Deprecate in favor of `.env` configuration. |
| [`docker-compose.yml`](../docker-compose.yml) | Default environment variable fallbacks for `POSTGRES_PASSWORD` and `JWT_SECRET_KEY`. | Medium | Ensure `.env` is populated with strong secrets before running in production. |
| [`.env.example`](../.env.example) | Example placeholder secret string for `JWT_SECRET_KEY`. | Informational | Production startup correctly rejects this placeholder (`test_config.py`). |

---

## 2. Quality Gate & Static Analysis Findings

### 2.1 Python Static Analysis (`ruff check backend tests`)
- **Status**: 140 errors reported.
- **Root Cause**:
  - `E501` (Line too long $> 100$ characters): Found in `backend/services/ml_microgrid_sync.py`, `backend/services/scheduler.py`, `backend/services/agnitia_ml_forecaster.py`, and test files.
  - `I001` (Unsorted import blocks): Unsorted import statements in recently added ML synchronization and regional validation tests.
  - `F401` (Unused imports): A small number of unused imports in test suites.
- **Impact**: Code formatting and style only; **zero runtime logic or functional defects**.
- **Fix Recommendation**: Run `ruff format` and `ruff check --fix` in post-hackathon refactoring.

### 2.2 Frontend Linter (`npm --prefix frontend run lint`)
- **Status**: 4 errors reported in `frontend/src/pages/Forecast.tsx`.
- **Root Cause**:
  - Lines 51, 53, 83, 85: Variables `cp1x` and `cp2x` used for cubic spline control point calculations are declared with `let` but never reassigned (`prefer-const`).
- **Impact**: Zero runtime failure; code compiles and bundles cleanly via Vite (`npm run build`).
- **Fix Recommendation**: Change `let` to `const` on lines 51, 53, 83, 85 of `frontend/src/pages/Forecast.tsx`.

---

## 3. Runtime & Architectural Observations

### 3.1 External Model Directory Path Dependency
- **Observation**: In `backend/services/agnitia_ml_forecaster.py`, the constant `MODEL_DIR` is set to `Path(r"D:\codes\model files for agnitia hack it")`.
- **Behavior**: On cloud deployments, Linux servers, or Docker containers where this host-specific Windows path does not exist, the service cleanly catches the `FileNotFound` exception and switches to its built-in **Analytical Diurnal Fallback Engine** with live Open-Meteo weather ingestion.
- **Remediation**: Package lightweight pre-trained model `.joblib` files inside the repository (e.g. `backend/models/weights/`) or fetch from cloud object storage (S3 / GCS) via signed URLs.

### 3.2 Large Uncompressed Root Assets
- **Observation**: Two high-resolution PNG files exist in the repository root:
  - `Gemini_Generated_Image_7ez0jh7ez0jh7ez0.png` (~2.8 MB)
  - `Gemini_Generated_Image_s8fp0ls8fp0ls8fp.png` (~2.8 MB)
- **Status**: Ignored by git in `.gitignore`.
- **Recommendation**: Move to an external asset bucket or delete to keep local disk usage minimal.

### 3.3 "Zero Simulation Policy" Language Refinement
- **Observation**: The initial project plan stated a "Zero Simulation Policy with zero synthetic curves". However, as the project evolved to meet hackathon presentation requirements:
  - An interactive 3D visual simulator was developed (`simulator/`).
  - An analytical diurnal model was added as an offline fallback when external ML weights are absent.
- **Remediation**: Re-worded README and documentation to clarify that **production hardware adapters ingest authentic physical telemetry**, while **visual simulations and analytical fallbacks exist as resilient demonstration backups**.

---

## 4. Prioritized Fix Backlog

```text
Priority 1 (Immediate Post-Hackathon):
- [ ] Fix 4 `prefer-const` ESLint warnings in `frontend/src/pages/Forecast.tsx`.
- [ ] Run `ruff check --fix` and `ruff format` across backend and tests.

Priority 2 (Next Milestone):
- [ ] Parameterize ML model weight paths via `MODEL_WEIGHTS_DIR` in `backend/config.py`.
- [ ] Replace hardcoded demo seed passwords with environment variable secrets.

Priority 3 (Production Hardening):
- [ ] Add Redis cache layer for high-throughput multi-client WebSocket broadcasts.
- [ ] Implement OAuth refresh token rotation for mobile Capacitor clients.
```
