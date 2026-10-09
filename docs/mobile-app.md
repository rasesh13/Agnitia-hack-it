# SURYA Ops Android App

`mobile/` is a lightweight Android companion app built with React 19 and Capacitor 8 (`appId` `in.surya.ops`). It shows live microgrid status, runs alert rules **on the phone** and raises local notifications, shows optimiser insights, and exposes force-cycle and emergency-stop controls. Build and signing steps are in `mobile/README.md`.

Related: [api-reference.md](api-reference.md) · [authentication-and-authorization.md](authentication-and-authorization.md) · [security.md](security.md)

---

## 1. Tooling

| Item | Value |
| --- | --- |
| Web layer | React 19, TypeScript ~6.0, Vite ^8.3 (`base: './'`, dev server 127.0.0.1:5190), lint with `oxlint` |
| Native | Capacitor 8 plugins: app, background-runner, haptics, local-notifications, preferences, splash-screen, status-bar |
| Android | `minSdk` 24, `compileSdk`/`targetSdk` 36, AGP 8.13, Gradle 8.14.3; README requires JDK 21 |
| Signing | `android/keystore.properties` (git-ignored); release builds are unsigned without it. R8 minification with keep rules in `android/app/proguard-rules.pro`. |
| Tests | None |

```bash
cd mobile
npm ci
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease   # Windows: gradlew.bat assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk
```

## 2. Structure

- `src/App.tsx`: bottom navigation with Home, Alerts, Energy, Insights and Control tabs. There is no router; tab state lives in `src/state/AppState.tsx`. Settings opens as an overlay.
- `src/screens/`: `SignIn`, `Home`, `Alerts`, `Energy`, `Insights`, `Control`, `Settings`.
- `src/lib/`:
  - `api.ts`: REST client.
  - `alerts.ts`: rule engine.
  - `notify.ts`: notification channels.
  - `storage.ts`: Capacitor Preferences.
  - `demo.ts`: offline demo data.
  - `format.ts`, `types.ts`.
- `public/runners/background.js`: background runner script.

## 3. Backend connection

- **Server address:** the sign-in screen pre-fills a hard-coded LAN address on port 8010 (`DEFAULT_SERVER` in `SignIn.tsx`). The user can edit it, and the last server used is remembered. `normaliseServerUrl` adds `http://` if no scheme is given.
- **Transport:** Capacitor native HTTP (`CapacitorHttp`), so browser CORS does not apply. Cleartext HTTP is allowed.
- **Backend binding:** the backend must listen on a reachable interface, for example `uvicorn backend.main:app --host 0.0.0.0 --port 8010`.

| Method | Path | Use |
| --- | --- | --- |
| GET | `/health` | "Test connection" button |
| POST | `/api/v1/auth/login` | Sign-in |
| GET | `/api/v1/twin/live?site_id=1` | Every refresh (required) |
| GET | `/api/v1/decisions/latest?site_id=1`, `/api/v1/decisions/stats?site_id=1`, `/api/v1/settings/control-policy` | Every refresh (best effort) |
| GET | `/api/v1/decisions?site_id=1&limit=30` | Decision feed |
| POST | `/api/v1/control/force-cycle` | Operator or admin |
| POST | `/api/v1/control/emergency-stop` | Admin; press and hold, reason required |

- **Polling:** every 10 s by default (configurable 5–60 s) while in the foreground.
- **No WebSocket and no Google sign-in.**
- **Errors:** a 401 signs the user out with "Your session expired".
- **Site:** `site_id` is fixed to 1.

## 4. On-device alert rules (`src/lib/alerts.ts`)

The backend raises no alerts, so the app evaluates these rules itself. The defaults are in `src/lib/types.ts`:

| Rule key | Condition | Severity |
| --- | --- | --- |
| `battery-soc` | Average SoC < 15 % / < 25 % | critical / warning |
| `grid-import` | `grid_import_kw` > 450 | warning |
| `telemetry-stale` | `data_freshness_age_seconds` > 120 | warning |
| `asset-<id>` | Status offline, fault or tripped / degraded, or quality `bad` | critical / warning |
| `temp-<id>` | Battery temperature > 45 °C | critical |
| `optimizer-cycle` | Latest cycle `failed` / `degraded` | critical / warning |
| `emergency-stop` | Control policy reports E-stop active | critical |
| `connection` | 3 consecutive refresh failures | warning |

Alert lifecycle:

- An alert opens when its condition appears and resolves when it clears.
- A change in severity resolves the old alert and opens a new one, so escalations notify again.
- History is capped at 150 entries.
- Thresholds are adjustable in Settings, except battery temperature.

**Notifications:** three channels (`surya-critical`, `surya-warning`, `surya-updates`). The notification ID is a hash of the alert key. Notifications are sent with `isExactNotification: false`, so the app does not need the exact-alarm permission.

**Background checks:** the background runner (event `checkAlerts`, about every 15 min, the WorkManager minimum) fetches `/twin/live` and `/settings/control-policy`. It evaluates only a subset of the rules: SoC, grid import, offline assets and E-stop.

## 5. Demo modes

- **"Explore demo":** an offline, time-of-day-driven fake microgrid (`src/lib/demo.ts`). It needs no backend.
- **"Prestige admin demo account":** signs in with hard-coded admin credentials. This is the same issue as [security finding S1](security.md#findings).

## 6. Limitations

- LAN-only HTTP, with no push notifications from the server.
- A 15-minute minimum background interval.
- No token refresh.
- `versionCode` is fixed at 1.
- Single site.
