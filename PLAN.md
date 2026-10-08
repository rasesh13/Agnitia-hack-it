# SURYA: Implementation Plan & Milestone Roadmap

This document outlines the step-by-step implementation plan for **SURYA** (Smart Unified Renewable Yield Automation), a production-oriented virtual power plant platform for multi-building campuses, strictly following [`spec.md`](file:///c:/Users/Kunal/OneDrive/Desktop/test/Agnitia-hack-it/spec.md).

> **Hard Boundary Reminder**: No simulator, synthetic curves, demo playback, or fake live data shall be implemented. Real adapter boundaries with offline/stale state indicators are used throughout.

---

## Roadmap Overview

```
[Milestones 1-3]   Scaffold, Config & Database Setup
       │
[Milestones 4-7]   Data Models, Authentication & Migrations
       │
[Milestones 8-11]  Telemetry Quality, Adapters & Digital Twin API
       │
[Milestones 12-17] Pure Optimization Modules (Reliability, Battery, VNM, Dispatch, Cost/Carbon)
       │
[Milestones 18-22] Decision Engine, Scheduler, WebSocket & API Endpoints
       │
[Milestones 23-30] Frontend React/TS Application & Operational Views
       │
[Milestones 31-34] End-to-End Integration, Deployment, Documentation & Quality Audit
```

---

## Detailed Milestones

- [x] **Milestone 1: Project Scaffolding, Tooling, & Configuration**
  - **Goal**: Set up repository layout, backend packaging (`pyproject.toml`/`requirements.txt`), frontend Vite React TS project skeleton, linting/formatting configs (`ruff`, `eslint`, `tsconfig`), `.gitignore`, and `.env.example`.
  - **Files**: `.gitignore`, `pyproject.toml`, `requirements.txt`, `.env.example`, `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`.
  - **Verification**: `ruff check backend/` runs cleanly; `npm --prefix frontend install` and `npm --prefix frontend run build` complete without errors.

- [x] **Milestone 2: Backend Core Configuration & Startup Validation**
  - **Goal**: Implement typed settings using Pydantic Settings (`backend/config.py`) validating all required configuration groups (Server, CORS, Auth, DB, Telemetry, Scheduler, Optimization weights summing to 1.0, Thresholds, Retention, Production checks), custom error envelope schemas, and structured logging.
  - **Files**: `backend/config.py`, `backend/models/schemas.py`, `backend/core/logging.py`, `tests/backend/test_config.py`.
  - **Verification**: `pytest tests/backend/test_config.py` passes for valid configurations and strictly rejects invalid weights, out-of-order thresholds, or weak secrets in production.

- [x] **Milestone 3: Database Engine & SQLAlchemy Base Setup**
  - **Goal**: Implement async SQLAlchemy engine, session management, declarative Base with UTC timestamp mixins, and Alembic migration infrastructure.
  - **Files**: `backend/db/database.py`, `backend/models/base.py`, `alembic.ini`, `backend/db/migrations/env.py`, `backend/db/migrations/script.py.mako`, `tests/backend/test_database.py`.
  - **Verification**: `pytest tests/backend/test_database.py` validates database connection and session creation against SQLite and PostgreSQL.

- [x] **Milestone 4: User Model, Authentication Schemas, & Password Hashing**
  - **Goal**: Define `User` SQLAlchemy model, role enum (`operator`, `admin`, `viewer`), Pydantic auth schemas, Argon2id password hashing helper, and JWT token generation/verification utilities.
  - **Files**: `backend/models/user.py`, `backend/models/schemas.py`, `backend/services/auth_crypto.py`, `tests/backend/test_auth_crypto.py`.
  - **Verification**: `pytest tests/backend/test_auth_crypto.py` tests Argon2id hashing/verification, JWT token creation, decoding, expiration, and claims (`user_id`, `role`, `token_version`).

- [x] **Milestone 5: Auth & Role Middleware, Rate Limiter, & Auth API Routes**
  - **Goal**: Implement rate limiting middleware (signup/login/google per IP), user repository, and FastAPI routers for signup, login, Google sign-in (verifying client ID and audience), and `/api/v1/auth/me`.
  - **Files**: `backend/api/rate_limit.py`, `backend/api/middleware.py`, `backend/api/routes_auth.py`, `backend/db/repositories/user_repo.py`, `backend/api/deps.py`, `tests/backend/test_routes_auth.py`.
  - **Verification**: `pytest tests/backend/test_routes_auth.py` covers signup, login, token issuance, protected `/me` endpoint, role authorization, and rate limiting.

- [x] **Milestone 6: Site, Asset, Building, and Battery Data Models & Initial Migration**
  - **Goal**: Define SQLAlchemy models for `Site`, `Asset`, `BuildingConfig`, `BatteryConfig`, `AlertThreshold`, `VNMSharingRule`, and `AuditEvent`. Create and verify initial Alembic migration.
  - **Files**: `backend/models/digital_twin.py`, `backend/models/config.py`, `backend/db/migrations/versions/001_initial_schema.py`, `tests/backend/test_models.py`.
  - **Verification**: Run migration upgrade and downgrade in tests; verify table structures, foreign keys, and constraints.

- [x] **Milestone 7: Telemetry Point, Current State, & Decision Log Data Models**
  - **Goal**: Define SQLAlchemy models for `TelemetryPoint` (interval/historical data), `AssetCurrentState` (latest twin state for fast reads), `DecisionCycle`, `DecisionLog`, `DecisionAlternative`, and `ControlCommand`. Update migration.
  - **Files**: `backend/models/telemetry.py`, `backend/models/decision_log.py`, `backend/db/migrations/versions/002_telemetry_decisions.py`, `tests/backend/test_telemetry_models.py`.
  - **Verification**: `pytest tests/backend/test_telemetry_models.py` verifies persistence and querying of telemetry points, digital twin states, and append-only decision audit records.

- [x] **Milestone 8: Telemetry Data Normalization & Quality Assessment Engine**
  - **Goal**: Implement canonical telemetry data schemas, unit conversions (kW, kWh, %, °C, m/s), quality classification (`good`, `suspect`, `stale`, `missing`, `invalid`), and staleness detection against `TELEMETRY_STALE_AFTER_SECONDS` and `TELEMETRY_FAILURE_AFTER_SECONDS`.
  - **Files**: `backend/models/telemetry.py`, `backend/services/telemetry_quality.py`, `tests/backend/test_telemetry_quality.py`.
  - **Verification**: `pytest tests/backend/test_telemetry_quality.py` validates quality tagging for missing, stale, out-of-range, and invalid readings.

- [x] **Milestone 9: Adapter Interface & Vendor-Neutral Protocol Adapters**
  - **Goal**: Define abstract `EnergyAdapter` (`read_snapshot`, `write_command`, `health`, `start`, `stop`) and concrete production adapters (REST, Modbus TCP/RTU, MQTT) with site configuration mapping, plus an in-memory test stub used exclusively in test scope.
  - **Files**: `backend/adapters/base.py`, `backend/adapters/rest.py`, `backend/adapters/modbus.py`, `backend/adapters/mqtt.py`, `backend/adapters/site_config.py`, `tests/backend/test_adapters.py`.
  - **Verification**: `pytest tests/backend/test_adapters.py` validates interface contracts, connection handling, snapshot normalization, and command execution.

- [x] **Milestone 10: Digital Twin Store & Aggregation Service**
  - **Goal**: Implement `DigitalTwinStore` service and repository for updating asset states from telemetry snapshots, computing campus aggregates (generation, demand, battery power, grid flow, counts of online/stale/offline assets), and storing interval telemetry without zero-filling missing measurements.
  - **Files**: `backend/services/digital_twin_store.py`, `backend/db/repositories/twin_repo.py`, `tests/backend/test_digital_twin_store.py`.
  - **Verification**: `pytest tests/backend/test_digital_twin_store.py` tests twin state upsert, aggregate metrics, and data quality preservation.

- [x] **Milestone 11: Digital Twin & Telemetry API Endpoints**
  - **Goal**: Implement REST endpoints: `/api/v1/twin/site`, `/api/v1/twin/buildings`, `/api/v1/twin/assets`, `/api/v1/twin/live`, `/api/v1/telemetry/series` returning freshness metadata (`observed_at`, `received_at`, `quality`, `status`, `age_seconds`).
  - **Files**: `backend/api/routes_twin.py`, `tests/backend/test_routes_twin.py`.
  - **Verification**: `pytest tests/backend/test_routes_twin.py` validates JSON schema compliance, query filtering, and freshness headers/fields.

- [x] **Milestone 12: Reliability Guard Engine**
  - **Goal**: Implement pure `ReliabilityGuard` service: reserve floor enforcement, battery minimum SoC protection, critical building/load protection before non-critical, deterministic shedding priority calculation, and emergency decision generation.
  - **Files**: `backend/services/reliability_guard.py`, `tests/backend/test_reliability_guard.py`.
  - **Verification**: `pytest tests/backend/test_reliability_guard.py` proves hard reliability constraints override economic actions, reserve floors are never violated, and shedding order is deterministic.

- [ ] **Milestone 13: Solar & Wind Forecast Engine**
  - **Goal**: Implement `ForecastEngine` service for solar generation, wind power, and campus demand forecasting using measured history or external forecast inputs, with confidence scoring and fallback handling when data is degraded.
  - **Files**: `backend/services/forecast_engine.py`, `tests/backend/test_forecast_engine.py`.
  - **Verification**: `pytest tests/backend/test_forecast_engine.py` validates forecast generation, horizon calculations, and degraded confidence handling.

- [ ] **Milestone 14: Battery Dispatch & Storage Scheduler**
  - **Goal**: Implement `BatteryScheduler` enforcing min/max SoC, charge/discharge power limits, battery health/temperature constraints, round-trip efficiency, and reserve floor calculations.
  - **Files**: `backend/services/battery_scheduler.py`, `tests/backend/test_battery_scheduler.py`.
  - **Verification**: `pytest tests/backend/test_battery_scheduler.py` covers battery charge/discharge bounds, degradation prevention, and expected SoC projections.

- [ ] **Milestone 15: Virtual Net Metering (VNM/GNM) Optimizer**
  - **Goal**: Implement `VNMOptimizer` supporting proportional and critical-first sharing ratios, ratio validation (summing to 1 or policy), allocated kWh and INR valuation, tariff tracking, and jurisdiction/rule version tagging.
  - **Files**: `backend/services/vnm_optimizer.py`, `tests/backend/test_vnm_optimizer.py`.
  - **Verification**: `pytest tests/backend/test_vnm_optimizer.py` tests ratio validation, proportional vs. critical-first allocations, tariff arithmetic, and rounding.

- [ ] **Milestone 16: Flexible Load Advisor & Demand-Side Management**
  - **Goal**: Implement `LoadAdvisor` service identifying flexible loads, recommending shift windows (start/end), expected surplus/deficit usage, estimated savings, and comfort constraints.
  - **Files**: `backend/services/load_advisor.py`, `tests/backend/test_load_advisor.py`.
  - **Verification**: `pytest tests/backend/test_load_advisor.py` verifies non-flexible loads remain untouched, shift windows are calculated, and savings estimates are generated.

- [ ] **Milestone 17: Cost & Carbon Optimization & Candidate Scoring**
  - **Goal**: Implement `CostOptimizer`, `CarbonOptimizer`, and candidate evaluation formula: $score(c) = w_{cost} \cdot normalized\_cost(c) + w_{carbon} \cdot normalized\_carbon(c)$ with deterministic tie-breakers (reliability margin, carbon, cost, candidate ID).
  - **Files**: `backend/services/cost_optimizer.py`, `backend/services/carbon_optimizer.py`, `backend/services/dispatch_optimizer.py`, `tests/backend/test_optimizer_scoring.py`.
  - **Verification**: `pytest tests/backend/test_optimizer_scoring.py` verifies cost/carbon normalization, candidate generation, constraint filtering, and deterministic ranking.

- [ ] **Milestone 18: Decision Manager & Immutable Audit Persistence**
  - **Goal**: Implement `DecisionManager` orchestrating full cycle sequence (read snapshot -> twin update -> forecast -> reliability guard -> candidate dispatch -> battery/VNM/load shift -> score -> persist decision & alternatives -> control commands if enabled).
  - **Files**: `backend/services/decision_manager.py`, `backend/db/repositories/decision_repo.py`, `tests/backend/test_decision_manager.py`.
  - **Verification**: `pytest tests/backend/test_decision_manager.py` verifies cycle states (`started`, `completed`, `degraded`, `blocked`, `failed`), immutable persistence, and reason codes.

- [ ] **Milestone 19: Decision Scheduler & Concurrency Lock**
  - **Goal**: Implement `DecisionScheduler` background worker with database/distributed lock to prevent overlapping cycles, handling fixed intervals from config, graceful shutdown, and health tracking.
  - **Files**: `backend/services/scheduler.py`, `tests/backend/test_scheduler.py`.
  - **Verification**: `pytest tests/backend/test_scheduler.py` proves lock prevents concurrent execution, scheduler catches errors gracefully, and records cycle status.

- [ ] **Milestone 20: Authenticated WebSocket Manager & Versioned Envelope**
  - **Goal**: Implement `WebSocketManager` with JWT auth, connection tracking, dead client cleanup, versioned envelope broadcasting (`twin_update`, `full_cycle`, `alert`, `health`, `error`), and non-blocking event dispatch.
  - **Files**: `backend/ws/websocket_manager.py`, `tests/backend/test_websocket_manager.py`.
  - **Verification**: `pytest tests/backend/test_websocket_manager.py` verifies authentication, envelope format, client broadcast, disconnect handling, and isolation from scheduler loop.

- [ ] **Milestone 21: Decisions, Settings, Control, & Health REST APIs**
  - **Goal**: Implement REST endpoints:
    - Decisions: `/api/v1/decisions`, `/api/v1/decisions/latest`, `/api/v1/decisions/{id}`, `/api/v1/decisions/stats`.
    - Settings: `/api/v1/settings/*` (alert thresholds, building tiers, VNM rules, assets, control policy) with optimistic concurrency/version check.
    - Control: `/api/v1/control/force-cycle`, `/api/v1/control/commands/{id}/acknowledge`, `/api/v1/control/emergency-stop`.
    - Health: `/health`, `/health/ready`, `/health/scheduler`.
  - **Files**: `backend/api/routes_decisions.py`, `backend/api/routes_settings.py`, `backend/api/routes_control.py`, `backend/api/routes_health.py`, `backend/main.py`, `tests/backend/test_routes_api.py`.
  - **Verification**: `pytest tests/backend/test_routes_api.py` tests all endpoints, role checks, validation, rate limiting, and emergency stop behavior.

- [ ] **Milestone 22: Reporting & CSV/PDF Export Service**
  - **Goal**: Implement `/api/v1/export/csv`, `/api/v1/export/pdf`, and `/api/v1/export/stats` with period, timezone, units, currency, tariffs, carbon factor, and data-quality disclosures.
  - **Files**: `backend/api/routes_export.py`, `backend/services/export_service.py`, `tests/backend/test_export.py`.
  - **Verification**: `pytest tests/backend/test_export.py` verifies CSV structure, PDF rendering, headers, filters, and quality disclosures.

- [ ] **Milestone 23: Frontend Core Setup, Typed API Client, & Auth State**
  - **Goal**: Setup React 18 + Vite + TS frontend infrastructure: styling, TypeScript API types matching backend schemas, Axios/fetch client with interceptors, AuthContext, ProtectedRoute, Login and Signup pages.
  - **Files**: `frontend/src/types/index.ts`, `frontend/src/services/api.ts`, `frontend/src/context/AuthContext.tsx`, `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/pages/Login.tsx`, `frontend/src/pages/Signup.tsx`, `frontend/src/App.tsx`.
  - **Verification**: `npm --prefix frontend run lint` and `npm --prefix frontend run build` pass cleanly; tests for AuthContext and route protection.

- [ ] **Milestone 24: Frontend WebSocket Provider & Live Twin State Management**
  - **Goal**: Implement `WebSocketContext` with auto-reconnect, exponential backoff, connection status indicators, staleness timer, and real-time twin state store.
  - **Files**: `frontend/src/context/WebSocketContext.tsx`, `frontend/src/hooks/useLiveTwin.ts`, `frontend/src/components/StatusBadge.tsx`, `frontend/src/components/ConnectionBanner.tsx`.
  - **Verification**: Frontend tests simulating WS events, reconnection backoff, and disconnected staleness badges.

- [ ] **Milestone 25: Overview / Mission Control Dashboard Page**
  - **Goal**: Build Mission Control view: Campus power balance card, Renewable generation vs Demand, Battery SoC & flow, Grid import/export, Data freshness indicators, Active alerts ticker, and Latest decision summary card.
  - **Files**: `frontend/src/pages/Overview.tsx`, `frontend/src/components/PowerFlowDiagram.tsx`, `frontend/src/components/MetricCard.tsx`, `frontend/src/components/FreshnessIndicator.tsx`.
  - **Verification**: Component tests and typecheck for Overview page with live, stale, and offline states.

- [ ] **Milestone 26: Digital Twin & Assets Management View**
  - **Goal**: Build Digital Twin view: Site hierarchy, Buildings list with criticality badges, Asset details (Solar, Wind, Battery, Loads, Meters), Live measurements, Quality flags, and capacity limits.
  - **Files**: `frontend/src/pages/DigitalTwin.tsx`, `frontend/src/components/BuildingCard.tsx`, `frontend/src/components/AssetDetailModal.tsx`.
  - **Verification**: Component tests checking rendering of building tiers, asset telemetry, and offline/stale status badges.

- [ ] **Milestone 27: Optimizer & Decision Timeline View**
  - **Goal**: Build Optimizer view: Decision timeline, filtering (by date, type, building, status), expandable decision cards showing plain-language reasoning, mathematical context, constraint checks, considered alternatives, and command execution status.
  - **Files**: `frontend/src/pages/Optimizer.tsx`, `frontend/src/components/DecisionCard.tsx`, `frontend/src/components/AlternativesModal.tsx`.
  - **Verification**: Component tests verifying decision detail expansion, filter actions, and alternative rejection reasons.

- [ ] **Milestone 28: Asset-Specific Views (Renewables, Battery, Grid)**
  - **Goal**: Build dedicated operational pages:
    - Renewables: Solar and Wind live power, daily yield, availability status, historical charts.
    - Battery: SoC gauge, charge/discharge rate, health (SOH), temperature, reserve floor indicator, operational limits.
    - Grid: Import/export power, active tariff, carbon emission factor, interval cost/carbon.
  - **Files**: `frontend/src/pages/Renewables.tsx`, `frontend/src/pages/Battery.tsx`, `frontend/src/pages/Grid.tsx`, `frontend/src/components/BatteryGauge.tsx`.
  - **Verification**: Component tests verifying data display, offline telemetry states, and unit formatting.

- [ ] **Milestone 29: Scheduler, Alerts, & Reports Pages**
  - **Goal**: Build operational tooling pages:
    - Scheduler view: Cycle status, last/next run times, duration, failure logs, and manual "Force Cycle" trigger button.
    - Alerts view: Active vs History alerts, severity badges, acknowledge action, stale telemetry alerts.
    - Reports view: Date range selector, metrics breakdown, data-quality disclosures, CSV and PDF download triggers.
  - **Files**: `frontend/src/pages/Scheduler.tsx`, `frontend/src/pages/Alerts.tsx`, `frontend/src/pages/Reports.tsx`, `frontend/src/components/AlertItem.tsx`.
  - **Verification**: Component tests for force-cycle triggering, alert acknowledgement, and report export requests.

- [ ] **Milestone 30: System Settings & Control Policy View (Admin Only)**
  - **Goal**: Build Settings page for administrators: Alert thresholds configuration, Building criticality tiers, VNM sharing ratios with validation, Asset limits, and Automated Control Policy toggle with Emergency Stop button.
  - **Files**: `frontend/src/pages/Settings.tsx`, `frontend/src/components/VNMConfigForm.tsx`, `frontend/src/components/EmergencyStopModal.tsx`.
  - **Verification**: Admin role protection tests, form validation tests, and emergency stop action tests.

- [ ] **Milestone 31: End-to-End Integration & System Health Diagnostics**
  - **Goal**: Implement end-to-end integration test flow covering adapter ingestion -> twin update -> decision cycle -> WebSocket broadcast -> API query -> export. Verify all system diagnostics endpoints.
  - **Files**: `tests/backend/test_e2e_pipeline.py`.
  - **Verification**: Full backend and frontend test suites pass (`pytest -q`, `npm --prefix frontend run test` or `build`).

- [ ] **Milestone 32: Docker, Reverse Proxy, & Deployment Configuration**
  - **Goal**: Create Dockerfile for backend, multi-stage Dockerfile for frontend, nginx reverse proxy configuration (serving SPA history fallback, proxying `/api` and `/ws`), `docker-compose.yml` (backend, frontend, postgres), and startup entrypoint running `alembic upgrade head`.
  - **Files**: `backend/Dockerfile`, `frontend/Dockerfile`, `nginx/nginx.conf`, `docker-compose.yml`, `backend/entrypoint.sh`.
  - **Verification**: Verify Docker configuration syntax, nginx route proxying, and ensure zero simulator references exist.

- [ ] **Milestone 33: Documentation & Production Runbooks**
  - **Goal**: Write comprehensive documentation:
    - `docs/ARCHITECTURE.md` (System architecture, dependency flow, data models, decision pipeline).
    - `docs/OPERATIONS.md` (Runbooks for adapter outage, stale telemetry, command failures, emergency stop, scheduler failures, backup/restore).
    - `docs/API.md` (REST & WebSocket specification).
    - `README.md` (Quickstart, setup, configuration, quality gates, operational guides).
  - **Files**: `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/API.md`, `README.md`.
  - **Verification**: Verify documentation completeness, formatting, and link validity.

- [ ] **Milestone 34: Final Quality Gate & Spec Compliance Audit**
  - **Goal**: Run all quality gates (`ruff check backend/`, `pytest -q`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`), perform full compliance check against `spec.md` (verify NO simulator artifacts or dependencies, verify all 22 sections satisfied).
  - **Files**: Entire repository.
  - **Verification**: All quality gates pass with 0 errors and 0 warnings; specification compliance checklist verified.
