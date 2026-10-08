# SURYA Platform Architecture Specification

Smart Unified Renewable Yield Automation (SURYA) is a production-grade energy management and microgrid optimization platform designed for commercial, industrial, and academic campuses.

---

## 1. High-Level Architectural Layers

SURYA is organized into six strictly decoupled layers with unidirectional dependency flow:

```
+-------------------------------------------------------------------------+
|                              PRESENTATION                               |
|          React 18 + TypeScript + Tailwind CSS Single Page App           |
+-------------------------------------------------------------------------+
                                    ▲
                   REST API / JSON  │  WebSocket Events
                                    ▼
+-------------------------------------------------------------------------+
|                              API GATEWAY                                |
|        FastAPI + Correlation ID Middleware + JWT Role Auth (RBAC)       |
+-------------------------------------------------------------------------+
                                    ▲
                                    ▼
+-------------------------------------------------------------------------+
|                       CORE ENGINE & SCHEDULER                           |
|       Decision Pipeline • Multi-Objective Optimizer • Safety Guard      |
|             Idempotent Command Queue • Audit Event Logger               |
+-------------------------------------------------------------------------+
                                    ▲
                                    ▼
+-------------------------------------------------------------------------+
|                          DIGITAL TWIN STORE                             |
|          Real-time Asset State Machine • Campus Power Aggregator         |
|                     Telemetry Quality & Staleness Engine                |
+-------------------------------------------------------------------------+
                                    ▲
                                    ▼
+-------------------------------------------------------------------------+
|                          PERSISTENCE LAYER                              |
|           SQLAlchemy 2.0 Async ORM • PostgreSQL 16 / SQLite             |
|                   Alembic Database Schema Migrations                    |
+-------------------------------------------------------------------------+
                                    ▲
                                    ▼
+-------------------------------------------------------------------------+
|                          HARDWARE ADAPTERS                              |
|       Fail-Safe Inverters • Modbus/MQTT Interfaces • Smart Meters       |
|    (Fail-Safe Adapter Boundaries — Zero Fake/Synthetic Curve Generators)|
+-------------------------------------------------------------------------+
```

---

## 2. Telemetry Ingestion & Quality Validation

SURYA implements an immutable, strongly-typed ingestion boundary. All incoming hardware metrics are transformed into standardized `CanonicalMeasurement` models:

- **Telemetry Quality Flags**:
  - `good`: Valid physical reading received within nominal freshness window ($t_{\text{age}} \le 30\text{s}$).
  - `suspect`: Measurement violates physical sanity envelopes (e.g., negative solar power or voltage outside $\pm 15\%$).
  - `stale`: Measurement timestamp exceeds freshness threshold ($t_{\text{age}} > 30\text{s}$).
  - `missing`: Asset is expected to report but no measurement packet has been received.
  - `invalid`: Checksum, syntax, or parity failure at adapter boundary.

---

## 3. Mathematical Optimization Formulation

The decision engine evaluates campus power flows every cycle ($\Delta t = 60\text{s}$) using a scalarized multi-objective formulation balancing monetary cost reduction against carbon emissions abatement.

### 3.1 Objective Function

$$\min_{u_t \in \mathcal{U}} \quad J(u_t) = w_{\text{cost}} \cdot C(u_t) + w_{\text{carbon}} \cdot E(u_t)$$

Where:
- $w_{\text{cost}} + w_{\text{carbon}} = 1.0 \quad (w_{\text{cost}}, w_{\text{carbon}} \ge 0)$
- $C(u_t)$: Net cost of energy exchange across interval $\Delta t$ at active Time-of-Day (TOD) tariff:
  $$C(u_t) = \max(0, P_{\text{grid}}(u_t)) \cdot \tau_{\text{import}}(t) \cdot \Delta t - \max(0, -P_{\text{grid}}(u_t)) \cdot \tau_{\text{export}}(t) \cdot \Delta t$$
- $E(u_t)$: Net operational carbon footprint:
  $$E(u_t) = \max(0, P_{\text{grid}}(u_t)) \cdot \kappa_{\text{grid}} \cdot \Delta t$$
  with Central Electricity Authority (CEA) baseline carbon factor $\kappa_{\text{grid}} = 0.82\text{ kg CO}_2\text{e/kWh}$.

### 3.2 Battery Energy Storage System (BESS) State of Charge Dynamics

$$SoC(t + \Delta t) = SoC(t) - \frac{P_{\text{bess}}(t) \cdot \Delta t}{E_{\text{rated}} \cdot \eta_{\text{bess}}}$$

Subject to hard operational safety envelopes:
$$SoC_{\text{min}} \le SoC_{\text{reserve}} \le SoC(t) \le SoC_{\text{max}}$$
$$-P_{\text{charge, max}} \le P_{\text{bess}}(t) \le P_{\text{discharge, max}}$$

### 3.3 Virtual Net Metering (VNM) Sharing Matrix

For campus buildings sharing localized solar generation:
$$\sum_{i=1}^{N_{\text{buildings}}} \alpha_i = 1.00 \quad \left(\alpha_i \ge 0\right)$$
$$E_{\text{allocated}, i} = \alpha_i \cdot E_{\text{solar, surplus}}$$

---

## 4. Concurrency, Locks, & Idempotency

1. **Cycle Execution Lock**: In-memory async lock (`asyncio.Lock`) prevents overlapping optimization cycles.
2. **Snapshot Hashing**: Each decision cycle computes a SHA-256 hash of the complete telemetry input vector, ensuring determinism and verifiable auditability.
3. **Idempotent Control Commands**: All issued inverter commands include UUIDv4 `idempotency_key`, validity time window (`valid_from` to `valid_until`), and explicit target setpoint to prevent duplicate hardware actuation.

---

## 5. Security & Role-Based Access Control (RBAC)

- **Authentication**: JWT Bearer tokens signed with HMAC-SHA256. Passwords hashed using Argon2id with unique cryptographic salts.
- **Roles**:
  - `admin`: Full system configuration, policy tuning, VNM ratio updates, Emergency Stop engagement.
  - `operator`: Real-time telemetry monitoring, force optimization cycle trigger, command execution acknowledgement.
  - `viewer`: Read-only access to mission control dashboards, digital twin metrics, and reporting downloads.
