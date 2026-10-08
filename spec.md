# SURYA: Implementation Specification

## 1. Purpose

Build SURYA (Smart Unified Renewable Yield Automation), a production-oriented virtual power plant platform for multi-building campuses. SURYA receives telemetry from physical energy assets, maintains a digital twin, evaluates renewable dispatch and demand-side actions, protects critical loads, and presents auditable recommendations and outcomes to authorized operators.

This document is the implementation contract for a new project. An implementation agent should treat the requirements below as authoritative when choosing names, module boundaries, API behavior, database schema, UI states, and acceptance tests.

The system is not a physics playground. It is an operations product whose calculations are driven by measured or externally supplied telemetry.

## 2. Hard Boundary: No Simulator

The simulator must not be implemented in any way.

The implementation MUST NOT include:

- A physics simulator, synthetic energy generator, scenario engine, accelerated clock, or demo playback mode.
- Solar, wind, demand, battery, or occupancy curves intended to manufacture telemetry.
- A `simulator/` package, `backend/simulator/` package, simulator scripts, simulator routes, simulator controls, or simulator UI.
- Fake live data, hard-coded dashboard readings, mock production telemetry, or fallback values that look like real measurements.
- A `SIMULATOR_TIME_SCALE`, `SIMULATOR_DEFAULT_SCENARIO`, scenario selector, or equivalent setting.
- A frontend 3D campus simulator or a build step that produces simulator assets.
- Simulator-specific dependencies, test commands, documentation, screenshots, or deployment services.

The implementation MUST use an adapter boundary for real telemetry. During development, tests may use a small in-memory adapter stub that returns explicitly declared test fixtures, but that stub is test-only, must never be imported by the application startup path, and must never be presented as live data.

When telemetry is unavailable, the product MUST show `offline`, `degraded`, `unknown`, or `stale` state. It must not substitute invented values.

## 3. Product Outcomes

The completed system must allow an authorized operator to:

1. Sign up, sign in, and maintain an authenticated session.
2. View current campus and building telemetry with freshness and quality indicators.
3. See solar, wind, battery, demand, grid, and carbon metrics from connected assets.
4. Review the latest optimization cycle and the reasoning behind each decision.
5. Understand which loads are protected, shiftable, or eligible for shedding.
6. Configure alert thresholds, building criticality, and virtual net-metering sharing rules.
7. Trigger a manual decision cycle when permitted.
8. Export decision and savings reports as CSV and PDF.
9. Receive live twin and decision updates over an authenticated WebSocket.
10. Diagnose adapter, database, scheduler, and telemetry health from the application.

The system must optimize cost and carbon subject to reliability and operational constraints. Reliability always wins over economic optimization.

## 4. Users and Permissions

### 4.1 Roles

- `operator`: view live data, decisions, alerts, and reports; trigger a manual cycle.
- `admin`: all operator permissions plus manage users, site configuration, thresholds, criticality, VNM rules, and adapter configuration.
- `viewer`: read-only access to live data, decisions, alerts, and reports.

The first authenticated user may be provisioned as an administrator through an explicit bootstrap configuration. Do not create an undocumented backdoor.

### 4.2 Authentication

- Use JWT access tokens signed with HS256 or a stronger configured algorithm.
- Hash local passwords with Argon2id through a maintained password library.
- Support Google sign-in only when a Google client ID is configured and the server verifies the ID token audience and signature.
- Rate-limit signup, login, and Google authentication per client IP and return consistent error responses.
- Store token claims with user ID, role, issued-at, expiry, and token version.
- WebSocket authentication must use a short-lived access token passed through a secure connection flow. Do not log tokens.
- Production startup must fail if the JWT secret is missing, weak, or equal to a documented development placeholder.
- CORS must use an explicit production allowlist. Wildcard origins with credentials are forbidden.

## 5. System Architecture

### 5.1 Runtime Components

1. **Web frontend**: React 18 + TypeScript + Vite. Provides authenticated operations views and consumes REST plus WebSocket data.
2. **API service**: FastAPI application exposing auth, health, twin, decision, settings, control, and export endpoints.
3. **Decision scheduler**: Background service in the API process or a separately deployable worker. It runs a fixed production interval from configuration and must prevent overlapping cycles.
4. **Adapter layer**: Vendor-neutral interface for telemetry reads, control writes, health, and lifecycle. Production adapters connect to approved physical gateways or vendor APIs.
5. **Digital twin store**: SQLAlchemy persistence for the latest known asset state, telemetry quality, timestamps, and configuration.
6. **Decision engine**: Forecast, reliability, dispatch, battery, VNM, load-shift, cost, and carbon modules orchestrated by one decision manager.
7. **WebSocket manager**: Authenticated fan-out of twin updates, cycle results, health, and error events.
8. **Relational database**: PostgreSQL in production; SQLite may be used for local development only if behavior remains compatible with PostgreSQL.

### 5.2 Dependency Direction

- API routes may call application services, schemas, and authentication dependencies.
- Services may call repositories, the adapter interface, and pure optimization modules.
- Optimization modules must be pure or side-effect-light and must not import FastAPI, React, database sessions, or concrete vendor adapters.
- Concrete adapters must implement the adapter interface and must not be imported by optimization modules.
- Frontend components must use typed API/client modules and shared contexts; components must not construct raw URLs or duplicate WebSocket connections.
- Database writes must occur through repositories or clearly scoped service methods.

## 6. Repository Shape

Use this target structure, omitting all simulator paths:

```text
backend/
  api/
    middleware.py
    rate_limit.py
    routes_auth.py
    routes_decisions.py
    routes_export.py
    routes_health.py
    routes_settings.py
    routes_twin.py
    routes_control.py
  adapters/
    base.py
    modbus.py              # production implementation, if supported
    mqtt.py                # production implementation, if supported
    rest.py                # production implementation, if supported
    site_config.py
  db/
    database.py
    repositories/
    migrations/
  models/
    base.py
    user.py
    digital_twin.py
    decision_log.py
    config.py
    telemetry.py
    schemas.py
  services/
    scheduler.py
    decision_manager.py
    digital_twin_store.py
    forecast_engine.py
    reliability_guard.py
    dispatch_optimizer.py
    battery_scheduler.py
    vnm_optimizer.py
    load_advisor.py
    cost_optimizer.py
    carbon_optimizer.py
    telemetry_quality.py
  ws/
    websocket_manager.py
  config.py
  main.py
frontend/
  src/
    components/
    context/
    hooks/
    lib/
    pages/
    services/
    types/
    App.tsx
    index.css
    main.tsx
docs/
  ARCHITECTURE.md
  OPERATIONS.md
  API.md
tests/
  backend/
  frontend/
```

Do not create a simulator directory or rename a 3D simulator into a disguised equivalent.

## 7. Configuration

All settings must be loaded from environment variables using typed settings validation. Commit `.env.example`, never real secrets.

Required configuration groups:

- Server: `BACKEND_HOST`, `BACKEND_PORT`, `ENVIRONMENT`.
- CORS: `CORS_ORIGINS`.
- Auth: `JWT_SECRET_KEY`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, optional `GOOGLE_CLIENT_ID`.
- Database: `DATABASE_URL`.
- Telemetry: `TELEMETRY_POLL_INTERVAL_SECONDS`, `TELEMETRY_STALE_AFTER_SECONDS`, `TELEMETRY_FAILURE_AFTER_SECONDS`.
- Scheduler: `DECISION_CYCLE_SECONDS`, `SCHEDULER_ENABLED`.
- Optimization: `COST_WEIGHT`, `CARBON_WEIGHT`, `GRID_EMISSION_FACTOR_KG_PER_KWH`.
- Alerts: low battery, critical battery, high grid import, reserve floor, and data staleness thresholds.
- Battery: minimum and maximum state of charge, maximum charge/discharge rate, and health floor.
- Grid: import tariff, export tariff, currency, and site timezone.
- Adapter: selected production adapter type and vendor connection settings. Secrets must be injected through environment or a secret manager.
- Retention: telemetry retention and decision audit retention days.

Validate at startup:

- Cost and carbon weights are each between 0 and 1 and sum to 1 within a documented tolerance.
- Thresholds are ordered and physically meaningful.
- Poll and decision intervals are positive.
- Production has explicit CORS origins and a strong JWT secret.
- Production has a configured non-test adapter.

## 8. Telemetry and Adapter Contract

### 8.1 Adapter Interface

Define an abstract `EnergyAdapter` with these asynchronous operations:

```python
@property
async def read_snapshot(self) -> EnergySnapshot: ...
async def write_command(self, command: ControlCommand) -> CommandResult: ...
async def health(self) -> AdapterHealth: ...
async def start(self) -> None: ...
async def stop(self) -> None: ...
```

The interface must be vendor-neutral. Concrete implementations may use Modbus TCP/RTU, MQTT, REST, or another approved protocol, but the rest of the application must not know which protocol is active.

### 8.2 Canonical Snapshot

Every measurement must include:

- stable asset ID and asset type;
- measurement timestamp from the source when available;
- server receipt timestamp;
- value and unit;
- quality: `good`, `suspect`, `stale`, `missing`, or `invalid`;
- source/adapter ID;
- optional error or diagnostic code.

Supported asset types are `site`, `building`, `solar`, `wind`, `battery`, `load`, `grid`, and `meter`.

Canonical values include:

- power in kW;
- energy in kWh with an interval or cumulative semantic;
- battery SoC and health in percent;
- battery temperature in Celsius;
- wind speed in m/s and direction in degrees;
- grid import/export power and energy;
- voltage, current, frequency, and power factor where available;
- building demand and criticality metadata.

Never infer a missing measurement as zero unless the source contract explicitly defines zero and the quality remains visible.

### 8.3 Telemetry Quality

- Mark a reading stale after `TELEMETRY_STALE_AFTER_SECONDS`.
- Mark an asset unavailable after `TELEMETRY_FAILURE_AFTER_SECONDS` or adapter health failure.
- Exclude stale or invalid readings from optimization unless a module explicitly supports a conservative bounded estimate.
- A decision cycle with insufficient data must emit a `blocked` or `degraded` result with a reason, not a normal dispatch command.
- The UI must display the age and quality of the data used for each key metric.

### 8.4 Control Commands

Commands must be explicit, validated, idempotency-keyed, and auditable. A command contains target asset, action, requested setpoint, unit, valid-from, valid-until, reason, originating decision ID, and operator/system actor.

The adapter must return `accepted`, `rejected`, `timeout`, or `failed` with a vendor-safe diagnostic. A rejected command must never be reported as executed.

Default policy is recommendation-only until a site administrator explicitly enables closed-loop writes for the adapter. Even in closed-loop mode, reliability limits and emergency stop rules are mandatory.

## 9. Digital Twin

Persist the latest authoritative state for each site, building, solar array, wind turbine, battery, load, meter, and grid connection.

Each twin record must include:

- identity and site relationship;
- rated capacity and operating limits;
- latest measurements;
- measurement and receipt timestamps;
- telemetry quality and adapter health;
- operational status;
- configuration version;
- created/updated timestamps.

Persist interval telemetry separately when retention and reporting require it. Do not make the dashboard reconstruct historical truth from frontend state.

Expose campus aggregates computed from current valid readings, plus explicit counts for online, stale, and offline assets.

## 10. Decision Cycle

The scheduler runs every `DECISION_CYCLE_SECONDS` and must use a distributed or database-backed lock when more than one worker can run. A cycle has a unique ID and lifecycle status: `started`, `completed`, `degraded`, `blocked`, or `failed`.

The cycle order is:

1. Read the adapter snapshot and health.
2. Validate measurement timestamps, units, ranges, and quality.
3. Upsert the digital twin and interval telemetry.
4. Broadcast a `twin_update` event.
5. Build an immutable cycle input snapshot.
6. Generate a forecast from available measured history or an explicitly configured external forecast source. If forecast inputs are unavailable, mark forecast confidence accordingly.
7. Run the reliability guard first.
8. Generate dispatch candidates for solar, wind, battery, grid import, and grid export.
9. Generate battery schedules within SoC, rate, temperature, and health constraints.
10. Generate VNM allocations using configured building ratios and applicable regulatory rules.
11. Generate load-shift recommendations for eligible flexible loads.
12. Score candidates for cost and carbon.
13. Reject any candidate violating reliability, asset, grid, or data-quality constraints.
14. Select the lowest weighted score, with deterministic tie-breakers: reliability margin, carbon, cost, then stable candidate ID.
15. Persist every selected decision and the material alternatives considered.
16. Execute commands only when closed-loop control is enabled and the decision is actionable.
17. Persist command outcomes.
18. Broadcast a `full_cycle` event with decisions, health, quality, and execution outcomes.

No cycle may silently partially succeed. Each partial result must identify which module failed and which outputs were withheld.

## 11. Optimization Requirements

### 11.1 Objective

For candidate strategy $c$:

$$
score(c) = w_{cost} \cdot normalized\_cost(c) + w_{carbon} \cdot normalized\_carbon(c)
$$

where $w_{cost} + w_{carbon} = 1$. Normalization must be documented and stable across a cycle. Lower is better.

### 11.2 Reliability Guard

Reliability is a hard constraint, not a score bonus. The guard must:

- maintain a configurable reserve floor for critical loads;
- prevent battery discharge below minimum SoC;
- detect projected shortfall over the configured horizon;
- protect critical buildings and loads before non-critical loads;
- produce a deterministic shedding priority list;
- reject economic actions that would violate reserve or critical-load coverage;
- emit a reliability decision when emergency protection is active.

### 11.3 Dispatch

Dispatch must account for current power, forecast power, demand, battery limits, tariffs, grid import/export limits, and asset availability. Renewable energy should serve eligible demand before grid import, subject to export economics and operating constraints.

### 11.4 Battery

Battery actions must enforce minimum/maximum SoC, charge/discharge power, health, temperature, efficiency, and reserve floor. Every battery decision must state target action, requested rate, expected SoC after action, and constraint checks.

### 11.5 VNM/GNM

VNM allocation must:

- use configured per-building sharing ratios;
- validate ratios are non-negative and sum according to the selected policy;
- support proportional and critical-first allocation strategies;
- show allocated kWh and INR value;
- retain the tariff and rule version used;
- never claim regulatory compliance without a documented rule version and administrator-configured jurisdiction.

### 11.6 Load Shifting

Only loads marked flexible may receive shift recommendations. A recommendation must include load ID, start/end window, expected surplus or deficit, estimated savings, comfort/operational constraints, and confidence. A recommendation is not an executed control action unless explicitly accepted and supported by the adapter.

### 11.7 Cost and Carbon

Cost calculations must separate import cost, export credit, battery degradation cost when configured, and other configured charges. Carbon calculations must identify the grid emission factor and renewable attribution method. Every report must disclose units, currency, timezone, calculation window, and data quality limitations.

## 12. Data Model

Use SQLAlchemy models with Alembic migrations. Minimum tables:

- `users`: ID, email, password hash, Google subject, role, active flag, token version, timestamps.
- `sites`: site identity, timezone, jurisdiction, currency, configuration version.
- `assets`: asset identity, type, parent relationship, rated limits, adapter mapping, active flag.
- `building_configs`: building name, criticality tier, flexible-load policy, operational metadata.
- `battery_configs`: SoC limits, reserve floor, power limits, efficiency, health policy.
- `telemetry_points`: normalized measurements with quality and timestamps.
- `asset_current_state`: latest twin state for fast reads.
- `alert_thresholds`: threshold, unit, severity, active flag, updated-by, timestamps.
- `vnm_sharing_rules`: building, ratio, rule version, effective dates, updated-by.
- `decision_cycles`: cycle ID, input snapshot hash, status, timing, health summary.
- `decision_logs`: immutable selected decisions, actor, reason, confidence, expected savings, carbon impact, context JSON, cycle ID.
- `decision_alternatives`: rejected candidates and rejection reason where required for audit.
- `control_commands`: requested command, idempotency key, status, timestamps, adapter response, decision ID.
- `audit_events`: configuration changes, authentication/security events, and privileged actions.

Decision and audit records must be append-only from application code. Corrections use compensating records rather than destructive updates.

## 13. REST API Contract

All protected routes use `/api/v1` and Bearer authentication. Return typed JSON errors with `code`, `message`, `request_id`, and optional `details`.

### Authentication

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/google`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout` if server-side token revocation is implemented

### Health and readiness

- `GET /health`: liveness only.
- `GET /health/ready`: database, adapter, scheduler, and configuration readiness.
- `GET /health/scheduler`: last cycle, next cycle, lock state, and failure count.

### Digital twin and telemetry

- `GET /api/v1/twin/site`
- `GET /api/v1/twin/buildings`
- `GET /api/v1/twin/assets`
- `GET /api/v1/twin/live`
- `GET /api/v1/telemetry/series`

Responses must include `observed_at`, `received_at`, `quality`, `status`, and `age_seconds` for live measurements.

### Decisions and reports

- `GET /api/v1/decisions`
- `GET /api/v1/decisions/latest`
- `GET /api/v1/decisions/{decision_id}`
- `GET /api/v1/decisions/stats`
- `GET /api/v1/export/csv`
- `GET /api/v1/export/pdf`
- `GET /api/v1/export/stats`

Decision list endpoints need pagination, stable ordering, date filters, type filters, building filters, and status filters.

### Settings and configuration

- `GET|PUT /api/v1/settings/alert-thresholds/{threshold_id}`
- `GET|PUT /api/v1/settings/building-tiers/{building_id}`
- `GET|PUT /api/v1/settings/vnm-sharing-rules/{building_id}`
- `GET|PUT /api/v1/settings/assets/{asset_id}`
- `GET|PUT /api/v1/settings/control-policy`

All writes require admin role, validation, audit events, and optimistic concurrency or an explicit version check.

### Control

- `POST /api/v1/control/force-cycle`: operator/admin; rate-limited and returns cycle ID.
- `POST /api/v1/control/commands/{command_id}/acknowledge`: operator/admin where manual acknowledgement is required.
- `POST /api/v1/control/emergency-stop`: admin only; records an audit event and disables automated writes.

Never expose a simulator scenario endpoint.

## 14. WebSocket Contract

Endpoint: `GET /ws` with authenticated token handling.

Use a versioned envelope:

```json
{
  "version": 1,
  "type": "twin_update",
  "message_id": "uuid",
  "sent_at": "ISO-8601 timestamp",
  "request_id": "uuid-or-null",
  "data": {}
}
```

Supported event types:

- `twin_update`: current valid/stale asset states and aggregate metrics.
- `full_cycle`: cycle status, decisions, alternatives summary, quality, and command outcomes.
- `alert`: newly raised, acknowledged, or cleared alert.
- `health`: adapter, database, and scheduler health.
- `error`: safe client-facing error with request ID.

Clients must reconnect with bounded exponential backoff, avoid duplicate connections, and mark displayed values stale when disconnected. The server must remove dead connections and avoid blocking the scheduler on slow clients.

## 15. Frontend Requirements

Use the existing React + TypeScript + Vite direction and preserve typed service boundaries. Required views:

1. Authentication: login, signup, Google sign-in when configured, and clear error states.
2. Overview/Mission Control: campus power balance, renewable generation, demand, battery SoC, grid flow, data freshness, current alerts, and latest decisions.
3. Digital Twin: buildings and assets with status, measurements, quality, age, and capacity.
4. Optimizer: decision timeline, filters, confidence, reasoning, constraints, alternatives, and execution status.
5. Renewables: solar and wind live/historical telemetry with unavailable states.
6. Battery: SoC, power, health, temperature, reserve floor, and recent actions.
7. Grid: import/export, tariffs, carbon factor, and interval cost/carbon.
8. Scheduler: cycle status, last/next run, duration, failures, and force-cycle action.
9. Alerts: active/history views, severity, source, timestamps, acknowledgement, and stale telemetry alerts.
10. Reports: date filters, data-quality disclosure, CSV/PDF downloads.
11. Settings: thresholds, criticality, VNM rules, site assets, and control policy for administrators.

UI rules:

- Never render zero, placeholder telemetry, or fabricated charts when data is missing.
- Display a clear badge for `live`, `stale`, `offline`, `degraded`, or `unknown`.
- Keep decision explanations plain-language but expose technical context on demand.
- Use one shared WebSocket state provider for the application.
- REST remains the source for historical and paginated data; WebSocket is for live updates.
- Handle loading, empty, unauthorized, forbidden, validation, server error, and disconnected states on every page.
- Keep controls disabled when the backend says an asset is unavailable or closed-loop control is disabled.
- Preserve keyboard navigation, semantic labels, visible focus, adequate contrast, responsive layouts, and reduced-motion behavior.

## 16. Observability and Operations

Implement structured logs with timestamp, level, service, request ID, cycle ID, user ID where safe, asset ID where relevant, and event name. Never log credentials, JWTs, password hashes, or raw vendor secrets.

Measure:

- adapter read latency and failure count;
- telemetry freshness and invalid-reading count;
- cycle duration, status, and module failures;
- decision count by type and status;
- command acceptance, rejection, timeout, and failure;
- WebSocket connections and dropped messages;
- API latency and error rate.

Provide readiness checks that fail when the database is unavailable, migrations are incomplete in production, or the configured production adapter cannot report health.

Use UTC for persistence and ISO-8601 timestamps over APIs. Convert to site timezone only for presentation and report labels.

## 17. Security and Safety

- Validate all input with Pydantic schemas and explicit ranges.
- Use parameterized database queries and ORM protections.
- Apply authentication and role checks at router boundaries.
- Rate-limit credential, force-cycle, and command endpoints.
- Add request correlation IDs and safe generic 500 responses.
- Configure security headers at the frontend proxy.
- Do not allow arbitrary adapter commands from the browser.
- Require server-side authorization for every asset and configuration mutation.
- Enforce command idempotency and expiry.
- Add emergency stop behavior that immediately blocks automated writes while retaining read-only telemetry.
- Treat stale telemetry as a safety event when it affects reliability calculations.
- Include an operator-visible reason whenever automation is blocked or degraded.

## 18. Testing Strategy

The implementation is incomplete until these checks exist and pass:

### Backend

- Unit tests for each optimizer with boundary conditions and invalid inputs.
- Reliability tests proving critical loads are protected and reserve floors cannot be violated.
- Battery tests for SoC, rate, health, temperature, and efficiency limits.
- VNM tests for ratio validation, proportional allocation, critical-first allocation, and rounding.
- Telemetry quality tests for missing, stale, invalid, out-of-order, and unit-invalid readings.
- Adapter contract tests using a test-only stub; no simulator package or runtime.
- API tests for authentication, authorization, validation, pagination, errors, and exports.
- WebSocket tests for authentication, event envelopes, reconnect-safe behavior, and dead clients.
- Scheduler tests proving no overlapping cycles, correct status transitions, and graceful shutdown.
- Migration tests against PostgreSQL-compatible behavior.

### Frontend

- Type checking and linting.
- Component tests for live, stale, offline, empty, loading, and error states.
- Auth route protection tests.
- WebSocket reducer/client tests for reconnect, duplicate messages, malformed events, and disconnect state.
- Decision rendering tests for every decision type and command outcome.
- Accessibility checks for primary workflows.

### Required quality gates

```text
ruff check backend/
pytest -q
npm --prefix frontend run lint
npm --prefix frontend run build
```

The project must not have a `test:simulator`, `dev:sim`, `dev:twin`, simulator build, simulator dependency, or simulator acceptance test.

## 19. Deployment

Provide:

- development instructions for backend, frontend, and PostgreSQL;
- Dockerfiles or equivalent reproducible builds for API and frontend;
- a production compose or deployment manifest without any simulator service;
- an entrypoint that runs `alembic upgrade head` before the production API starts;
- a reverse proxy serving the SPA with history fallback and forwarding `/api` and `/ws` correctly;
- health checks for liveness and readiness;
- documented secret and environment configuration;
- backup and restore notes for PostgreSQL;
- migration rollback guidance;
- an operational runbook for adapter outage, stale telemetry, command failure, emergency stop, and scheduler failure.

The frontend must receive API and WebSocket origins from build-time configuration such as `VITE_API_URL` and `VITE_WS_URL`. Production URLs must not default silently to localhost.

## 20. Implementation Sequence

Implement in this order:

1. Project configuration, typed settings, logging, request IDs, and error envelope.
2. Database base, migrations, users, sites, assets, configuration, and audit tables.
3. Authentication, roles, rate limiting, and protected route dependencies.
4. Adapter interface, production adapter integration, telemetry normalization, quality tracking, and health.
5. Digital twin repositories and live twin endpoints.
6. Scheduler lifecycle, cycle lock, cycle records, and WebSocket infrastructure.
7. Reliability guard and pure optimization modules.
8. Decision manager, persistence, command policy, and audit trail.
9. Decision, settings, control, health, and export APIs.
10. Frontend auth shell, typed client, shared live state, and error/freshness handling.
11. Frontend operational pages and settings.
12. Tests, migrations validation, Docker, reverse proxy, documentation, and quality gates.

At the end of each step, run the narrowest relevant test before proceeding. Do not build UI against invented backend data.

## 21. Definition of Done

The project is complete only when all of the following are true:

- A fresh checkout can be configured from `.env.example` and started without undocumented steps.
- Production startup rejects weak secrets, invalid optimization weights, missing production adapter configuration, and incomplete migrations.
- A connected real adapter can publish telemetry into the digital twin without changing optimizer code.
- Missing or stale telemetry is visible and never masquerades as live data.
- A complete decision cycle produces an immutable, explainable audit record and broadcasts a versioned event.
- Reliability constraints override cost and carbon objectives in tests and at runtime.
- Control writes are disabled by default, authorized, idempotent, bounded, and auditable.
- REST, WebSocket, frontend, and database contracts are typed and documented.
- CSV/PDF exports disclose period, timezone, units, tariffs, carbon factor, and data-quality limitations.
- The frontend is usable on desktop and mobile and has explicit loading, empty, stale, offline, and error states.
- All required quality gates pass.
- No simulator code, simulator UI, simulator endpoint, simulator dependency, simulator documentation, or simulator deployment artifact exists anywhere in the project.

## 22. Agent Implementation Guidelines

When implementing this specification:

- Prefer the smallest change that satisfies a requirement and preserves existing public contracts.
- Read the owning abstraction and its nearest tests before editing.
- Keep optimization math deterministic and independently testable.
- Keep vendor-specific behavior inside adapters.
- Make data freshness a first-class field, not a frontend guess.
- Never hide an unavailable capability behind a fake success state.
- Add migrations for every schema change.
- Add tests with every behavioral change.
- Validate after each edit with the narrowest executable check.
- Do not refactor unrelated code while implementing a requirement.
- Do not add simulator-like conveniences even for demos; use explicit test fixtures only in test scope.
- Document assumptions, regulatory rule versions, units, and timezone behavior.
- Treat security, reliability, and auditability as release-blocking requirements.
