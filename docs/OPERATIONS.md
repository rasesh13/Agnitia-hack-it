# SURYA Production Operations & Runbooks Manual

This guide outlines standard operational procedures, emergency incident response runbooks, and disaster recovery workflows for the SURYA Operations Platform.

---

## Runbook 1: Adapter Disconnection & Hardware Telemetry Loss

### Symptoms
- Overview dashboard displays `STALE` or `DISCONNECTED` banner.
- Data Freshness Indicator age exceeds threshold ($> 30\text{s}$).
- Telemetry quality flags transition to `stale` or `missing`.

### Automated System Behavior
1. The Digital Twin Store marks the affected asset's telemetry quality as `stale`.
2. The Optimization Engine automatically switches to **Degraded Optimization Mode**, holding the last verified safe inverter setpoints.
3. Automated battery discharge commands are blocked if BESS telemetry age exceeds 60 seconds to prevent deep-discharge violations.

### Operator Actions
1. Inspect the physical network connection and Modbus/MQTT gateway for the reporting substation or inverter.
2. Verify adapter health logs:
   ```bash
   docker logs surya_backend --tail 100 | grep -i "adapter"
   ```
3. Test connectivity to the physical gateway IP address or serial port.
4. Once connection is restored, trigger a manual telemetry refresh or force an optimization cycle from the **Scheduler** page in the UI.

---

## Runbook 2: Inverter / BESS Control Command Execution Failure

### Symptoms
- Command status shows `rejected`, `timeout`, or `failed` in the Optimizer timeline.
- Inverter active setpoint does not match requested dispatch level.
- `BESS Command Timeout` warning alert generated.

### Automated System Behavior
1. The command state machine marks the command as `failed`.
2. Closed-loop dispatcher prohibits duplicate retries beyond the command's `valid_until` timestamp.
3. System logs an audit event detailing adapter response code and error reason.

### Operator Actions
1. Navigate to **Optimizer & Decisions** in the UI and inspect the failed command card.
2. Check physical inverter alarms on-site or via local web interface (e.g., thermal limit, grid frequency deviation trip).
3. If hardware condition is nominal, acknowledge the failed command and issue a **Force Cycle** to generate a refreshed setpoint.

---

## Runbook 3: Emergency Stop (E-Stop) Activation & De-escalation

### Indications for E-Stop Engagement
- Physical grid fault, transformer fire, or utility line work without scheduled isolation.
- Severe battery thermal excursion ($T_{\text{cell}} > 55^\circ\text{C}$).
- Unsanctioned reverse power flow tripping utility breakers.

### Activation Procedure
1. Click the red **EMERGENCY STOP** button in the top navigation bar or **Settings** page.
2. Enter a mandatory audit justification (e.g., `Emergency maintenance on 11kV transformer feeder block A`).
3. Confirm action in the modal dialog.

### System Response
- `emergency_stop_active` flag set to `true`.
- `closed_loop_enabled` immediately forced to `false`.
- All automated BESS discharge setpoints set to `0.0 kW` (Standby mode).
- Critical high-priority audit event persisted with operator identity and timestamp.

### De-escalation Procedure
1. Verify all physical site hazards are resolved and equipment is safe to energize.
2. In the UI, click **Clear Emergency Stop** and enter post-incident resolution notes.
3. Verify telemetry readings in **Mission Control** are live and within safe nominal ranges.

---

## Runbook 4: Scheduler Daemon Recovery & Worker Hangs

### Symptoms
- Last Cycle Timestamp in **Scheduler** is more than 3 minutes old.
- Health endpoint `/health/scheduler` returns degraded status or consecutive failures $> 3$.

### Recovery Steps
1. Query system health:
   ```bash
   curl -s http://localhost:8000/health/scheduler | jq
   ```
2. If scheduler lock is stuck, restart backend container:
   ```bash
   docker compose restart backend
   ```
3. Verify clean startup and DB connection:
   ```bash
   docker logs surya_backend --tail 50
   ```

---

## Runbook 5: Database Backup, Restore, and Schema Migrations

### Automated Database Backup
```bash
docker exec -t surya_postgres pg_dump -U surya_user -d surya_db -F c -b -v -f /var/lib/postgresql/data/surya_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Database Restore
```bash
docker exec -i surya_postgres pg_restore -U surya_user -d surya_db -c -v /var/lib/postgresql/data/surya_backup_TARGET.dump
```

### Applying Schema Migrations
```bash
docker exec -it surya_backend alembic upgrade head
```
