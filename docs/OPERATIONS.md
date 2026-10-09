# SURYA Platform Operations Manual & Runbooks

> **Deployment Configurations, Environment Profiles, Database Migrations, and Emergency Runbooks**

---

## 1. Environment Configuration Variables (`.env`)

SURYA follows 12-factor configuration principles managed via Pydantic Settings (`backend/config.py`).

| Variable | Default Value | Production Requirement | Purpose |
| :--- | :--- | :--- | :--- |
| **`ENVIRONMENT`** | `development` | `production` | Enables strict guardrails (rejects weak JWT secrets and wildcard CORS). |
| **`BACKEND_HOST`** | `0.0.0.0` | `0.0.0.0` | Bind host for the Uvicorn ASGI server. |
| **`BACKEND_PORT`** | `8000` | Port assigned by orchestrator | Internal service port. |
| **`DATABASE_URL`** | `sqlite+aiosqlite:///./surya_dev.db` | `postgresql+asyncpg://user:pass@host:5432/surya` | Primary relational connection string. |
| **`JWT_SECRET_KEY`** | *(Dev placeholder)* | **Must be 32+ cryptographically random chars** | Signs and verifies user authentication tokens. |
| **`JWT_ACCESS_TOKEN_EXPIRE_MINUTES`** | `120` | `60` to `1440` | Lifetime of generated JWT access tokens. |
| **`CORS_ORIGINS`** | `http://localhost:5173,...` | Explicit domains (e.g. `https://surya-sim.vercel.app`) | Strict CORS allowlist; wildcard `*` rejected in production. |
| **`GOOGLE_CLIENT_ID`** | None | Google OAuth Web Client ID | Enables secure "Continue with Google" authentication. |
| **`TELEMETRY_POLL_INTERVAL_SECONDS`**| `5` | `5` | Cadence for polling physical hardware gateways. |
| **`TELEMETRY_STALE_AFTER_SECONDS`** | `30` | `30` | Threshold after which readings are flagged `stale`. |
| **`TELEMETRY_FAILURE_AFTER_SECONDS`**| `60` | `60` | Threshold after which assets are marked `offline`. |
| **`DECISION_CYCLE_SECONDS`** | `60` | `60` | Cadence of the automated optimization dispatch loop. |
| **`SCHEDULER_ENABLED`** | `true` | `true` | Enables continuous background optimization cycles. |
| **`COST_WEIGHT`** | `0.6` | Float [0..1] | Weight assigned to financial cost reduction. |
| **`CARBON_WEIGHT`** | `0.4` | Float [0..1] | Weight assigned to carbon emissions abatement ($w_{\text{cost}} + w_{\text{carbon}} = 1.0$). |
| **`GRID_EMISSION_FACTOR_KG_PER_KWH`**| `0.82` | `0.82` | Central Electricity Authority (CEA) carbon factor. |
| **`BATTERY_MIN_SOC`** | `10.0` | $10.0\%$ | Non-violable battery discharge floor. |
| **`BATTERY_MAX_SOC`** | `95.0` | $95.0\%$ | Battery over-charge safety ceiling. |
| **`ALERT_RESERVE_FLOOR_PERCENT`** | `20.0` | $20.0\%$ | Battery energy reserve locked for Tier 1 critical loads. |
| **`SEED_DEMO_DATA`** | `false` | `true` on demo deployments | Bootstraps Prestige University microgrid profile and accounts. |

---

## 2. Deployment Architectures

### 2.1 Docker Compose (Local & Self-Hosted Production)
Deploys a complete 3-tier stack using [`docker-compose.yml`](../docker-compose.yml):
- **`postgres`**: PostgreSQL 16 Alpine with `pg_isready` healthcheck probe.
- **`backend`**: FastAPI backend with non-root security execution and automatic migration execution.
- **`frontend`**: High-performance Alpine Nginx reverse proxy serving the compiled SPA and proxying API/WebSockets.

```bash
# Start all containers in background
docker compose up --build -d

# Check live logs
docker compose logs -f backend

# Shutdown cleanly
docker compose down
```

### 2.2 PaaS Deployment (Render + Vercel)
- **Backend API on Render (`render.yaml`)**:
  - Web Service bound to managed PostgreSQL database.
  - Start command runs `alembic upgrade head` before Uvicorn starts.
  - Health probe monitored at `/health`.
- **Frontend SPA on Vercel (`vercel.json`)**:
  - Edge static deployment with automated monorepo build (`npm run build:simulator && npm run build`).
  - HTML5 SPA rewrites (`/(.*) -> /index.html`) and 1-year immutable caching on static assets.

---

## 3. Database Schema Migrations (Alembic)

SURYA manages relational schemas using Alembic async migrations (`backend/db/migrations/`).

```bash
# Check current migration revision
alembic current

# Apply all pending migrations to latest head
alembic upgrade head

# Rollback one migration revision
alembic downgrade -1

# Generate a new auto-detected migration
alembic revision --autogenerate -m "add_column_name"
```

---

## 4. Health Checks & Diagnostics

SURYA provides three discrete diagnostic endpoints:

1. **Liveness Probe**:
   ```bash
   curl -f http://localhost:8000/health
   # Response: {"status": "ok", "service": "surya-vpp-backend"}
   ```
2. **Readiness Probe**:
   ```bash
   curl -f http://localhost:8000/health/ready
   # Response: {"status": "ready", "database": "connected"}
   ```
3. **Optimization Scheduler Health**:
   ```bash
   curl -s http://localhost:8000/health/scheduler | jq
   # Inspects total cycles executed, failures, consecutive errors, and active lock state.
   ```

---

## 5. Incident Response Runbooks

### Runbook 1: Emergency Stop (E-Stop) Activation & Recovery

#### Symptoms & Triggers:
- Field transformer fault, utility feeder trip, or battery thermal alarm ($T > 55^\circ\text{C}$).
- Manual intervention required to protect personnel or physical plant.

#### Procedure:
1. **Engage E-Stop**:
   - In the Web Console, click the red **EMERGENCY STOP** button in the header bar or **Settings**.
   - Enter a mandatory audit reason (e.g. `Physical maintenance on 11kV busbar`).
   - Confirm engagement.
   - *Automated system action: Sets `emergency_stop_active=True`, forces `closed_loop_enabled=False`, freezes BESS dispatch to `0.0 kW` (Standby).*
2. **Resolve On-Site Hazard**:
   - Verify site equipment is physically safe and cleared.
3. **De-escalate**:
   - In the console, click **Clear Emergency Stop** and enter resolution audit notes.
   - Verify Mission Control readings return to nominal operating parameters.

---

### Runbook 2: Stale Telemetry & Field Adapter Disconnect

#### Symptoms:
- Overview displays `STALE` or `DISCONNECTED` indicator.
- Data age exceeds 30 seconds (`is_stale=True`).
- Asset states tagged `stale` or `missing`.

#### Automated System Behavior:
1. The optimization scheduler transitions to **Degraded Safe Mode**, holding last verified safe inverter setpoints.
2. Battery discharge commands are blocked if telemetry age exceeds 60 seconds to prevent unmonitored over-discharge.

#### Operator Recovery Steps:
1. Inspect physical Modbus TCP / MQTT gateway network connectivity:
   ```bash
   ping <gateway_ip>
   ```
2. Inspect backend adapter error logs:
   ```bash
   docker logs surya_backend --tail 100 | grep -i "adapter"
   ```
3. Once the physical gateway reconnects, verify telemetry freshness returns to `< 5s`.

---

### Runbook 3: Scheduler Stuck / Overlapping Concurrency Lock

#### Symptoms:
- Last cycle completed timestamp in `/health/scheduler` is $> 3\text{ minutes}$ old.
- `consecutive_failures` metric increases.

#### Recovery Steps:
1. Inspect scheduler diagnostic endpoint:
   ```bash
   curl -s http://localhost:8000/health/scheduler | jq
   ```
2. If `lock_held` is true and cycle has hung on external I/O:
   ```bash
   docker compose restart backend
   ```
3. Verify clean startup and scheduler cycle resumption in logs:
   ```bash
   docker logs surya_backend --tail 50 | grep -i "scheduler"
   ```

---

### Runbook 4: Database Backup & Point-in-Time Restore

#### Create Database Backup:
```bash
docker exec -t surya_postgres pg_dump -U surya_user -d surya_db -F c -b -v -f /var/lib/postgresql/data/surya_backup.dump
```

#### Restore Database from Backup:
```bash
# 1. Stop backend service to drop active connections
docker compose stop backend

# 2. Restore schema and data
docker exec -t surya_postgres pg_restore -U surya_user -d surya_db -v -c /var/lib/postgresql/data/surya_backup.dump

# 3. Restart backend service
docker compose start backend
```
