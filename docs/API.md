# SURYA Platform API & WebSocket Specification

> **Complete RESTful Endpoint Reference & Real-Time WebSocket Streaming Interface**  
> Generated from FastAPI OpenAPI Schema and Backend Router Code

---

## 1. Authentication & Role-Based Access Control (RBAC)

All endpoints—except public health checks and initial login routes—require an authenticated JWT Bearer token:

```http
Authorization: Bearer <jwt_access_token>
```

### RBAC Roles:
- **`viewer`**: Read-only access to digital twin states, telemetry, forecasts, decision audits, and exports.
- **`operator`**: Viewer permissions plus triggering manual optimization cycles (`force-cycle`) and command acknowledgments.
- **`admin`**: Full administrative access including system settings, control policy weights, VNM sharing rules, emergency stop, and user management.

---

## 2. System Health & Diagnostics

| Method | Path | Auth Role | Description & Responses |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Interactive HTML operations landing page or JSON API metadata. |
| `GET` | `/health` | Public | Liveness probe verifying server process responsiveness. Returns `{"status": "ok", "service": "surya-vpp-backend"}`. |
| `GET` | `/health/ready` | Public | Readiness probe verifying database connectivity. Returns `200 OK` or `503 Service Unavailable`. |
| `GET` | `/health/scheduler` | Public | Operational scheduler status, execution counters, last duration, and lock states. |

---

## 3. Authentication Endpoints (`/api/v1/auth`)

| Method | Path | Auth Role | Request Body | Response Schema / Status | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/signup` | Public | `UserCreateRequest` (`email`, `password`, `role`) | `UserReadResponse` (`id`, `email`, `role`, `created_at`) | `400` User exists, `422` Validation |
| `POST` | `/api/v1/auth/login` | Public | `UserLoginRequest` (`email`, `password`) | `TokenResponse` (`access_token`, `token_type`, `user`) | `401` Bad credentials, `429` Rate limit |
| `POST` | `/api/v1/auth/google` | Public | `GoogleAuthRequest` (`id_token`) | `TokenResponse` with authenticated session | `401` Token invalid, `403` Disabled |
| `GET` | `/api/v1/auth/me` | Viewer+ | None | `UserReadResponse` of active user | `401` Expired/Missing token |
| `POST` | `/api/v1/auth/logout` | Viewer+ | None | `{"message": "Successfully logged out"}` | `401` Unauthenticated |

---

## 4. Digital Twin & Telemetry API (`/api/v1/twin`, `/api/v1/telemetry`)

| Method | Path | Auth Role | Query Parameters | Description & Response Model |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/twin/site` | Viewer+ | `site_id=1` | Campus site metadata, jurisdiction, currency, and registered asset counts. |
| `GET` | `/api/v1/twin/buildings` | Viewer+ | `site_id=1` | List of campus buildings with criticality tier and live power demand. |
| `GET` | `/api/v1/twin/assets` | Viewer+ | `site_id=1`, `asset_type` (optional) | Registered assets with operational statuses and telemetry quality flags. |
| `GET` | `/api/v1/twin/live` | Viewer+ | `site_id=1` | Full campus digital twin snapshot with active power balance and battery SoC. |
| `GET` | `/api/v1/telemetry/series` | Viewer+ | `asset_id`, `metric_name`, `start_time`, `end_time` | Historical time-series telemetry points for charting. |
| `POST` | `/api/v1/twin/reset-to-zero` | Operator+ | None | Clears active generation states to 0.0 kW for zero-baseline demonstration. |
| `POST` | `/api/v1/twin/apply-ml-prediction` | Operator+ | `site_id`, `region_id` (optional) | Applies live ML model predictions to digital twin asset states. |
| `GET` | `/api/v1/twin/ml-comparison` | Viewer+ | None | Side-by-side comparison of baseline physics vs. LightGBM vs. XGBoost predictions. |
| `POST` | `/api/v1/twin/fluctuate-step` | Operator+ | `site_id`, `magnitude` | Steps live telemetry by a realistic micro-fluctuation. |
| `POST` | `/api/v1/twin/fluctuate-stream/start` | Operator+ | None | Starts background 3.0s continuous live weather telemetry streaming. |
| `POST` | `/api/v1/twin/fluctuate-stream/stop` | Operator+ | None | Halts background telemetry fluctuation streaming. |
| `GET` | `/api/v1/twin/fluctuate-stream/status` | Viewer+ | None | Checks whether background telemetry streaming is active. |

---

## 5. Optimization Decisions & Audit Timeline (`/api/v1/decisions`)

| Method | Path | Auth Role | Parameters | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/decisions` | Viewer+ | `site_id`, `decision_type`, `limit=50`, `offset=0` | Paginated decision audit timeline with reason logs and savings. |
| `GET` | `/api/v1/decisions/latest` | Viewer+ | `site_id=1` | Snapshot of the most recent decision cycle with evaluated alternatives. |
| `GET` | `/api/v1/decisions/stats` | Viewer+ | `site_id`, `from_dt`, `to_dt` | Cumulative financial savings in INR and avoided carbon emissions in kg. |
| `GET` | `/api/v1/decisions/{decision_id}` | Viewer+ | `decision_id` (path) | Full record of an individual decision cycle with mathematical context. |

---

## 6. Control & Actuation API (`/api/v1/control`)

| Method | Path | Auth Role | Request Body | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/control/force-cycle` | Operator+ | None | Forces execution of an immediate optimization dispatch cycle. |
| `POST` | `/api/v1/control/commands/{id}/acknowledge` | Operator+ | `CommandAckRequest` (`status`, `notes`) | Acknowledges or updates inverter/breaker command execution. |
| `POST` | `/api/v1/control/emergency-stop` | Admin | `EmergencyStopRequest` (`active`, `reason`) | Engages or disengages system E-Stop with mandatory audit log. |

---

## 7. System Settings & Configuration API (`/api/v1/settings`)

| Method | Path | Auth Role | Request Body | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/settings/control-policy` | Viewer+ | None | Current optimization weights ($w_{\text{cost}}, w_{\text{carbon}}$) and closed-loop state. |
| `PUT` | `/api/v1/settings/control-policy` | Admin | `ControlPolicyUpdate` | Updates objective weights (sum must equal 1.0) and cycle interval. |
| `GET` | `/api/v1/settings/vnm-sharing-rules` | Viewer+ | None | Active Virtual Net Metering allocation ratios per building. |
| `POST` | `/api/v1/settings/vnm-sharing-rules` | Admin | `VNMSharingRuleCreate` | Adds a new building VNM sharing rule. |
| `GET/PUT`| `/api/v1/settings/vnm-sharing-rules/{id}` | Admin | `VNMSharingRuleUpdate` | Updates building ratio ($\sum \alpha_i = 1.0$ enforced). |
| `GET` | `/api/v1/settings/building-tiers` | Viewer+ | None | Campus building criticality classifications. |
| `PUT` | `/api/v1/settings/building-tiers/{id}` | Admin | `BuildingTierUpdate` | Updates building tier (`critical`, `essential`, `non_critical`). |
| `GET` | `/api/v1/settings/alert-thresholds` | Viewer+ | None | Configured alarm thresholds (SoC, reserve floor, staleness). |
| `PUT` | `/api/v1/settings/alert-thresholds/{id}` | Admin | `AlertThresholdUpdate` | Updates numerical alarm threshold and active state. |
| `GET` | `/api/v1/settings/assets` | Viewer+ | None | Detailed technical asset profiles. |
| `PUT` | `/api/v1/settings/assets/{id}/battery` | Admin | `BatteryConfigUpdate` | Modifies BESS parameters ($SoC_{\text{min}}$, $SoC_{\text{max}}$, max charge rate). |

---

## 8. Compliance & ESG Reporting API (`/api/v1/export`)

| Method | Path | Auth Role | Query Parameters | Response Format |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/export/stats` | Viewer+ | `site_id`, `from_dt`, `to_dt` | JSON summary of energy volumes, savings, and data quality. |
| `GET` | `/api/v1/export/csv` | Viewer+ | `site_id`, `from_dt`, `to_dt` | RFC 4180 CSV spreadsheet download with `Content-Disposition`. |
| `GET` | `/api/v1/export/pdf` | Viewer+ | `site_id`, `from_dt`, `to_dt` | Branded executive PDF compliance report with data quality audit disclosures. |

---

## 9. 48-Hour ML & NWP Forecasting API (`/api/v1/forecast`)

| Method | Path | Auth Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/forecast/regions` | Viewer+ | Available regional microgrid profiles (National Grid, Rajasthan, Tamil Nadu, MP Indore, Gujarat). |
| `GET` | `/api/v1/forecast/48h` | Viewer+ | 48-hour hourly solar, wind, and demand forecasts with P10/P50/P90 quantile uncertainty bands. |
| `GET` | `/api/v1/forecast/metrics` | Viewer+ | Model accuracy benchmarks (MAE, RMSE, MAPE, $R^2$, and P10-P90 coverage). |
| `GET` | `/api/v1/forecast/site-metrics` | Viewer+ | Campus-specific model evaluation metrics for site 1. |
| `GET` | `/api/v1/forecast/live-comparison` | Viewer+ | Real-time prediction comparison across physics, LightGBM, and XGBoost models. |
| `GET` | `/api/v1/forecast/weather-live` | Viewer+ | Real-time Open-Meteo weather readings (GHI, DNI, temperature, wind speed). |
| `POST` | `/api/v1/forecast/reload` | Admin | Reloads trained model weights and metric artifacts from disk. |
| `POST` | `/api/v1/forecast/train-region` | Admin | Triggers on-demand regional model retraining pipeline. |

---

## 10. WebSocket Event Streaming Protocol (`/ws`)

Connect to the WebSocket endpoint passing a valid Bearer token as a query parameter:

```http
ws://<host>:<port>/ws?token=<jwt_access_token>
```

### 10.1 Standard Envelope Schema (`WebSocketEnvelope`)
Every message adheres to a versioned JSON envelope:

```json
{
  "version": 1,
  "type": "twin_update",
  "message_id": "c86a1df0-82a1-42ab-b193-41fca4e815e1",
  "sent_at": "2026-10-09T18:30:00.000Z",
  "request_id": null,
  "data": { ... }
}
```

### 10.2 Event Types & Data Payloads

#### `twin_update` (Real-Time Sub-Second Telemetry)
Broadcasts aggregate campus power flows and asset status changes:
```json
{
  "site_id": 1,
  "total_generation_kw": 328.4,
  "total_building_demand_kw": 215.0,
  "net_grid_flow_kw": -113.4,
  "average_battery_soc_percent": 68.5,
  "assets_online": 8,
  "assets_stale": 0
}
```

#### `full_cycle` (Completed Optimization Decision Cycle)
Broadcasts optimal setpoints, savings metrics, and plain-language reasoning:
```json
{
  "cycle_id": "cycle_20261009_183000",
  "site_id": 1,
  "selected_strategy": "SOLAR_SELF_CONSUMPTION_AND_STORAGE",
  "reason": "Mid-day solar generation exceeds campus load; charging BESS to avoid peak TOD window at 18:00.",
  "expected_savings_inr": 482.50,
  "carbon_impact_kg": 92.4,
  "commands": [
    {
      "command_id": "cmd_01",
      "target_asset": "BESS-01",
      "action": "SET_CHARGE_POWER",
      "setpoint_kw": 113.4
    }
  ]
}
```

#### `alert` (Threshold Violations & Faults)
```json
{
  "alert_id": "alt_01J7K...",
  "severity": "critical",
  "title": "BESS Reserve Floor Approached",
  "message": "Battery SoC is at 21.2% (reserve floor: 20.0%). Automated discharge throttled.",
  "timestamp": "2026-10-09T18:30:15.000Z"
}
```

#### `health` (Heartbeat)
Periodic heartbeat confirming active scheduler loop and adapter connection health.
