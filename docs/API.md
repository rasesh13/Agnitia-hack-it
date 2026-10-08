# SURYA Platform API & WebSocket Specification

The SURYA Operations Platform exposes a standardized RESTful API and real-time WebSocket event streaming interface.

---

## 1. Authentication & Security

All API endpoints (except `/api/v1/auth/login`, `/api/v1/auth/signup`, and `/health`) require a valid JWT Bearer token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

### Endpoints
- `POST /api/v1/auth/signup`: Create a new user account with initial role.
- `POST /api/v1/auth/login`: Authenticate email and password, returning JWT access token.
- `POST /api/v1/auth/google`: Exchange Google OAuth2 identity token for platform JWT.
- `GET /api/v1/auth/me`: Retrieve authenticated user identity and active role permissions.

---

## 2. Digital Twin & Telemetry API

- `GET /api/v1/twin/site?site_id={id}`: Retrieve site metadata and registered asset count.
- `GET /api/v1/twin/live?site_id={id}`: Full digital twin state with real-time aggregates, active power flow, and asset telemetry.
- `GET /api/v1/twin/buildings?site_id={id}`: Campus building list with criticality tiers, peak demand, and live consumption.
- `GET /api/v1/twin/assets?site_id={id}&asset_type={type}`: Filtered asset telemetry list.
- `GET /api/v1/telemetry/series?asset_id={id}&metric_name={metric}&start_time={iso}&end_time={iso}`: Historical interval series points.

---

## 3. Optimization Decisions & Audit Timeline

- `GET /api/v1/decisions?site_id={id}&decision_type={type}&limit=50&offset=0`: Paginated decision timeline.
- `GET /api/v1/decisions/latest?site_id={id}`: Full snapshot of the most recent optimization cycle including alternatives and commands.
- `GET /api/v1/decisions/stats?site_id={id}&from_dt={iso}&to_dt={iso}`: Aggregate decision statistics, total cost savings in INR, and carbon reduction in kg.
- `GET /api/v1/decisions/{decision_id}`: Detailed decision record with plain-language reasoning, mathematical context, and command statuses.

---

## 4. Control & Actuation API

- `POST /api/v1/control/force-cycle`: Trigger an immediate optimization cycle execution.
- `POST /api/v1/control/commands/{command_id}/acknowledge`: Acknowledge or update command execution status (`executed`, `rejected`, `failed`).
- `POST /api/v1/control/emergency-stop`: Engage or clear Emergency Stop with mandatory operational justification.

---

## 5. System Settings & Configuration API

- `GET /api/v1/settings/control-policy`: Retrieve current optimization weights ($w_{\text{cost}}, w_{\text{carbon}}$) and closed-loop mode.
- `PUT /api/v1/settings/control-policy`: Update control policy weights and cycle interval.
- `GET /api/v1/settings/vnm-sharing-rules`: Retrieve active Virtual Net Metering allocation ratios.
- `PUT /api/v1/settings/vnm-sharing-rules/{rule_id}`: Update building solar sharing ratio (sum must equal $1.00$).
- `GET /api/v1/settings/building-tiers`: Retrieve campus building criticality classifications.
- `PUT /api/v1/settings/building-tiers/{asset_id}`: Update building criticality tier.
- `GET /api/v1/settings/alert-thresholds`: Retrieve configured metric alarm thresholds.
- `PUT /api/v1/settings/alert-thresholds/{threshold_id}`: Update threshold value and active state.

---

## 6. Reporting & Compliance Export API

- `GET /api/v1/export/stats?site_id={id}&from_dt={iso}&to_dt={iso}`: Executive ESG carbon accounting metrics and data-quality disclosures.
- `GET /api/v1/export/csv?site_id={id}&from_dt={iso}&to_dt={iso}`: Download RFC 4180 compliant CSV audit spreadsheet.
- `GET /api/v1/export/pdf?site_id={id}&from_dt={iso}&to_dt={iso}`: Download branded PDF compliance executive report.

---

## 7. Diagnostics & System Health

- `GET /health`: Liveness probe for container orchestrator.
- `GET /health/ready`: Readiness probe verifying database connectivity and environment state.
- `GET /health/scheduler`: Optimization scheduler status, last execution duration, failure counts, and lock state.

---

## 8. WebSocket Event Streaming Protocol

Connect via WebSocket to `/ws?token=<jwt_token>`.

### Envelope Structure
```json
{
  "version": 1,
  "type": "twin_update",
  "message_id": "msg_01J7K...",
  "sent_at": "2026-10-08T18:30:00.000Z",
  "data": {
    "site_id": 1,
    "total_generation_kw": 78.5,
    "total_building_demand_kw": 55.0,
    "net_grid_flow_kw": -23.5,
    "average_battery_soc_percent": 65.0
  }
}
```

### Event Types
- `twin_update`: Periodic broadcast of live telemetry state and aggregate power flow.
- `full_cycle`: Broadcast upon completion of an optimization decision cycle.
- `alert`: Real-time notification of threshold breach or hardware fault.
- `health`: Periodic heartbeat from scheduler and adapter daemons.
