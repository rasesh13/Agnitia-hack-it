# Security

This is an evidence-based review of the security posture **as implemented on 2026-10-09**. Every finding cites the code it comes from. "Verified" means the behaviour was confirmed by reading the code path end to end, or by running it. "Potential" means the risk depends on deployment details that could not be confirmed.

Related: [authentication-and-authorization.md](authentication-and-authorization.md) · [deployment.md](deployment.md)

---

## 1. Controls that are in place

| Control | Where |
| --- | --- |
| Argon2id password hashing with reasonable parameters | `backend/services/auth_crypto.py` |
| JWT signature and expiry validation; revocation through `token_version` | `backend/api/deps.py` |
| Google ID tokens verified against Google JWKS (signature, audience, issuer, verified email) | `backend/services/google_identity.py` |
| Role-based guards on decision, settings, control and export routes | `require_*` in `backend/api/deps.py` |
| Generic login error that does not reveal which emails exist | `routes_auth.login` |
| Rate limiting on auth and force-cycle | `backend/api/rate_limit.py` |
| Strict request schemas (`extra="forbid"`) on most bodies | `backend/models/schemas.py` |
| ORM-built queries everywhere (no string-concatenated SQL found) | routers and repositories |
| Production startup refuses wildcard CORS, weak JWT secrets and the stub adapter | `Settings._validate_production_rules` |
| Audit trail for settings changes, emergency stop and command acknowledgement | `audit_events` |
| Non-root user in the backend container; security headers in nginx | `backend/Dockerfile`, `nginx/nginx.conf` |
| Secrets files git-ignored (`.env*`, `*.pem`, `*.key`, keystores) | `.gitignore`, `mobile/.gitignore` |

## Findings

Severity scale: **Critical** (direct compromise of the deployed system), **High**, **Medium**, **Low**.

| # | Severity | Issue | Affected code | Impact | Remediation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | **Critical** | Admin demo credentials are committed to the public repository and seeded on deployments with `SEED_DEMO_DATA=true`, which the Render blueprint sets | `backend/db/seed_demo_data.py`, `frontend/src/pages/Login.tsx`, `mobile/src/screens/SignIn.tsx`, `render.yaml` | Anyone can sign in as **admin** on the hosted demo: change settings, toggle the emergency stop, change policy | Read the demo password from an environment variable (or generate one at seed time). Seed demo users as `viewer`. Remove the one-click admin login from the clients. **Rotate:** change these accounts' passwords on every existing deployment. | Verified |
| S2 | **High** | State-changing ML and forecast routes have **no authentication**: `/api/v1/twin/{reset-to-zero, apply-ml-prediction, fluctuate-step, fluctuate-stream/start, fluctuate-stream/stop}` and `/api/v1/forecast/{reset-to-zero, apply-prediction, fluctuate-*, reload, train-region}` | `backend/api/routes_twin.py`, `backend/api/routes_forecast.py` | Anonymous users can zero or overwrite the digital twin, stop or start the live stream, and trigger model reloads | Add `Depends(require_operator_or_admin)` (or admin) to every mutating route | Verified |
| S3 | **High** | `POST /api/v1/forecast/train-region` is unauthenticated, runs model training synchronously in the request, and accepts `custom_file_path`, a **server filesystem path** read with pandas | `routes_forecast.train_new_region`, `training/step5_test_and_train_custom_region.py` | Denial of service (blocks the event loop, CPU and network). Probes for the existence of server files and parses any readable CSV or Parquet file. Writes model files to disk. | Require admin. Remove `custom_file_path` or restrict it to an allow-listed directory. Run training out of process. | Verified (code path) |
| S4 | **High** | Hard-coded privilege escalation: one specific email address is promoted to `admin` on every Google sign-in | `backend/api/routes_auth.py` (`google_auth`) | Admin access is tied to a personal account in source; hard to audit or revoke | Remove it. Add an admin-only role-management mechanism or a configurable bootstrap admin list. | Verified |
| S5 | **Medium** | New Google users get the `operator` role automatically, whereas email signups get `viewer` | `routes_auth.google_auth` | Any Google account holder can force optimisation cycles and acknowledge commands | Default new Google users to `viewer` | Verified |
| S6 | **Medium** | Rate limiter keys on the **first** `X-Forwarded-For` value, which the client controls | `backend/api/rate_limit.py` | The login brute-force limit can be bypassed by rotating the header | Use the proxy-resolved client IP (`request.client.host` with Uvicorn `--proxy-headers` and a trusted `forwarded-allow-ips`), or use the last trusted hop | Verified (code); exploitability depends on the proxy |
| S7 | **Medium** | Uvicorn runs with `--forwarded-allow-ips="*"` | `render.yaml`, `backend/entrypoint.sh` | Client-supplied forwarding headers are trusted for scheme and host | Restrict to the platform proxy's address range where possible | Potential |
| S8 | **Medium** | JWT stored in `localStorage` and passed in URL query strings (`/ws?token=`, and `?token=` on export links) | `frontend/src/context/AuthContext.tsx`, `WebSocketContext.tsx`, `services/api.ts` | Any XSS can steal tokens. Query-string tokens leak into proxy logs and browser history. | Keep the token in memory or an httpOnly cookie. Use a short-lived WebSocket ticket. Download exports with `fetch` plus a Blob. | Verified |
| S9 | **Medium** | Logout is client-side only in the web and mobile apps; the WebSocket ignores `token_version` | `AuthContext.logout`, `backend/ws/websocket_manager.py` | Stolen tokens stay valid for up to 120 min after "sign out" | Call `POST /auth/logout` on sign-out; check `token_version` and `is_active` in the WebSocket handshake | Verified |
| S10 | **Medium** | Insecure defaults in `docker-compose.yml`: a fallback `JWT_SECRET_KEY` and Postgres password, port 8000 published | `docker-compose.yml` | A deployment that forgets to set variables runs with publicly known secrets. The JWT fallback is long enough to pass the production check. | Remove the fallbacks so startup fails without them. Do not publish 8000 when using nginx. | Verified |
| S11 | **Medium** | Any authenticated viewer starts the ML stream from the UI, and `interval_seconds` has no lower bound | `frontend/src/components/MLTelemetryController.tsx`, `routes_twin.start_twin_fluctuation_stream` | A tiny interval creates a tight write loop on the database | Validate `interval_seconds` (for example ≥ 1) and restrict start/stop to operators | Verified (code) |
| S12 | **Medium** | The emergency stop does not stop the ML stream's decision cycles, and the flag is in memory and per process | `ml_microgrid_sync.generate_live_fluctuation_step`, `DecisionScheduler` | Operators may believe automation is halted when it is not; the state is lost on restart | Persist E-stop state; check it in every cycle entry point | Verified |
| S13 | **Low** | Readiness endpoint returns the raw database exception text | `routes_health.health_readiness` | Leaks internals (hostnames, driver errors) | Log the detail; return a generic status | Verified |
| S14 | **Low** | Log redaction keys are defined but never applied | `backend/core/logging.py` (`SENSITIVE_KEYS`) | Future log calls could write secrets | Apply redaction to `extra` fields or remove the false assurance | Verified |
| S15 | **Low** | Missing input validation: battery limits unbounded; invalid enum strings in acknowledge and threshold severity raise 500; control-policy weights not checked to sum to 1 | `backend/models/schemas.py`, `routes_settings.py`, `routes_control.py` | Admins can store physically invalid configuration; noisy 500s | Add Pydantic `Literal`/enum types and range validators | Verified |
| S16 | **Low** | Simulator `postMessage` uses `*` as target origin when there is no referrer | `simulator/src/App.jsx`, `RegionalCampusSimulator.jsx` | Telemetry-like data may be posted to an unexpected embedding origin (the data is non-sensitive) | Use an explicit allowed origin | Verified |
| S17 | **Low** | Mobile app permits cleartext HTTP and mixed content | `mobile/capacitor.config.ts`, `AndroidManifest.xml` | Credentials and JWTs travel unencrypted on the LAN | Use HTTPS when the backend is reachable over TLS; restrict cleartext with a network security config | Verified |
| S18 | **Info** | `/docs`, `/redoc` and `/openapi.json` are public in production | `backend/main.py` | Reveals the full API surface, including the unauthenticated routes | Consider disabling them in production or protecting them | Verified |

No secrets were found in tracked files other than S1 and the compose fallbacks (S10). The Google OAuth client ID in `render.yaml` is a public identifier, not a secret. The `.env` file and the Android keystore are git-ignored.

## 3. Areas reviewed with no finding

- **SQL injection:** all queries use SQLAlchemy expressions with bound parameters.
- **Password storage:** Argon2id; hashes are never returned (`UserReadResponse` omits them).
- **Google token forgery:** the signature is verified, not just decoded.
- **File uploads:** the API has no multipart upload endpoint (`python-multipart` is installed but unused).

## 4. Recommended priorities

1. Rotate and remove the demo admin credentials (S1). Protect the ML and forecast routes (S2, S3).
2. Remove the hard-coded admin email (S4). Make the Google default role `viewer` (S5).
3. Fix the rate-limiter IP source (S6). Make logout server-side (S9).
4. Address the remaining Medium and Low items as part of normal hardening.

## 5. Reporting

The repository has no `SECURITY.md` or disclosure process. Until one is added, report issues privately to the repository owner rather than in public issues.
