# SURYA (Smart Unified Renewable Yield Automation)

**SURYA** is a production-grade energy management and microgrid optimization platform engineered for multi-building commercial, industrial, and academic campuses. It integrates real-time digital twin monitoring, multi-objective cost and carbon optimization, Virtual Net Metering (VNM), Battery Energy Storage (BESS) degradation protection, and fail-safe closed-loop dispatch.

> **Zero Simulation Policy**: SURYA contains zero synthetic curve generators or fake data simulators. In production, it ingests authentic physical hardware telemetry via adapter boundaries with explicit staleness and quality indicators.

---

## Key Features

- **Real-Time Campus Digital Twin**: Full site hierarchy modeling Solar PV arrays, Wind turbines, BESS storage, Building load tiers, and Point of Common Coupling (PCC) utility grid interconnections.
- **Multi-Objective Optimization Engine**: Real-time scalarized cost vs. carbon optimization ($w_{\text{cost}} + w_{\text{carbon}} = 1.0$), evaluating Time-of-Day (TOD) tariffs and CEA standard regional carbon baselines ($0.82\text{ kg CO}_2\text{e/kWh}$).
- **Explainable Decisions & Alternatives**: Plain-language human-readable justifications, mathematical formulas, and rejected alternative evaluations for every dispatch setpoint.
- **Virtual Net Metering (VNM)**: Regulatory-compliant sharing ratio matrix ensuring 100.0% solar allocation across campus buildings.
- **BESS Degradation Guard**: Hard State-of-Charge (SoC) safety bounds, reserve floor protection, and C-rate limiting ($\le 0.5\text{C}$).
- **Production Emergency Stop**: Immediate closed-loop interlock with mandatory audit justification and inverter setpoint freeze.
- **WebSocket Streaming**: Sub-second live twin updates, alarm notifications, and full-cycle broadcasts with auto-reconnection and exponential backoff.
- **ESG Compliance Reporting**: RFC 4180 CSV spreadsheets and executive PDF report downloads with data quality disclosures.

---

## Technology Stack

- **Backend**: FastAPI, SQLAlchemy 2.0 (Async ORM), Alembic, Pydantic v2, Uvicorn, Argon2id, PyJWT, ReportLab.
- **Database**: PostgreSQL 16 (production), SQLite via aiosqlite (unit/integration tests).
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Deployment**: Docker, Multi-Stage Builds, Nginx Reverse Proxy, Docker Compose.

---

## Quickstart Guide

### 1. Running with Docker Compose (Recommended)

Clone the repository and start all services:

```bash
docker compose up --build -d
```

Access the platform:
- **Operations Dashboard**: [http://localhost](http://localhost)
- **API Documentation**: [http://localhost/docs](http://localhost/docs) (Development mode)
- **Health Check**: [http://localhost/health](http://localhost/health)

### 2. Running Locally for Development

#### Backend Setup:
```bash
# Create and activate Python virtual environment
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn backend.main:app --reload --port 8000
```

#### Frontend Setup:
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

---

## Quality Gates & Verification

All code in this repository satisfies strict production quality gates:

```bash
# 1. Run Python static analysis and linting (0 errors)
python -m ruff check backend tests

# 2. Run backend test suite (115 passing tests)
python -m pytest

# 3. Run frontend TypeScript linting (0 errors, 0 warnings)
npm --prefix frontend run lint

# 4. Build frontend production distribution bundle
npm --prefix frontend run build
```

---

## System Documentation

For detailed technical references, consult the documentation:
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System architecture, mathematical models, and concurrency control.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md): Incident runbooks, emergency stop procedures, and disaster recovery.
- [`docs/API.md`](docs/API.md): RESTful endpoints and WebSocket streaming protocol specification.
- [`spec.md`](spec.md): Complete platform specification and requirements.

---

## License

Proprietary and Confidential. Developed for Agnitia Hackathon 2026.
