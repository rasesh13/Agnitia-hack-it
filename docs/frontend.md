# Frontend (Web Console)

The operations console lives in `frontend/`. It is a single-page React 18 + TypeScript app built with Vite 5 and styled with Tailwind CSS 3. It also hosts the 3D simulator build under `/simulator/` (see [simulator.md](simulator.md)).

Related: [architecture.md](architecture.md) · [api-reference.md](api-reference.md) · [user-guide.md](user-guide.md) · [environment-configuration.md](environment-configuration.md)

---

## 1. Tooling

| Item | Value | Source |
| --- | --- | --- |
| Package | `surya-frontend` 0.1.0, ESM | `frontend/package.json` |
| Build | `tsc && vite build`, output in `frontend/dist/` | `package.json` |
| Dev server | Vite on port 5173. Proxies `/api` → `VITE_API_URL` or `http://127.0.0.1:8000`, and `/ws` → `VITE_WS_URL` or `ws://127.0.0.1:8000` | `frontend/vite.config.ts` |
| Path alias | `@` → `src/` | `vite.config.ts`, `tsconfig.json` |
| TypeScript | `strict`, `noUnusedLocals`, `noUnusedParameters`, target ES2020 | `tsconfig.json` |
| Lint | ESLint 8 + `@typescript-eslint`, react-hooks, react-refresh. The `lint` script turns off `no-explicit-any`, `exhaustive-deps` and `only-export-components`, and uses `--max-warnings 0`. `.jsx` files are not linted. | `.eslintrc.cjs`, `package.json` |
| Styling | Tailwind 3 with PostCSS and autoprefixer; `index.css` plus the landing-only `landing.css` and `landing-motion.css` | `tailwind.config.js` |
| Animation | framer-motion, GSAP with `@gsap/react`, Lenis (landing page only) | `package.json` |
| Icons and fonts | lucide-react; Outfit variable font (`@fontsource-variable/outfit`) | |
| Router / HTTP client / charts | **None.** Navigation is state-based, HTTP uses `fetch`, and charts are hand-drawn SVG. | |
| Tests | **None** | |

Scripts:

```bash
npm run dev               # Vite dev server
npm run build             # type-check + production build
npm run build:simulator   # npm ci + build ../simulator into public/simulator (git-ignored)
npm run lint
npm run preview           # serve dist/
```

## 2. Entry and navigation

```text
index.html → src/main.tsx → <App/> (src/App.tsx)
  └─ <AuthProvider>
       └─ RootApp  view: 'landing' | 'login' | 'signup' | 'console'
            ├─ landing → pages/LandingPage.tsx → pages/Landing/LandingPage.tsx
            ├─ login   → pages/Login.tsx
            ├─ signup  → pages/Signup.tsx
            └─ console (authenticated) → <WebSocketProvider><AuthenticatedApp/></WebSocketProvider>
```

- **No URL routing.** The `console` view is remembered in `sessionStorage.surya_view` and the active tab in `localStorage.surya_active_tab`. Deep links to a page are not possible; `vercel.json` rewrites every path to `index.html`.
- **Loading splash:** while `AuthContext.isLoading` is true, a full-screen "Initializing SURYA System" splash is shown. This also happens during a login request.
- **Console tabs** (`AuthenticatedApp` in `App.tsx`):

| Tab | Component | Visible to |
| --- | --- | --- |
| Overview ("Mission Control") | `pages/Overview.tsx` | all |
| Forecast | `pages/Forecast.tsx` | all |
| Digital Twin | `pages/DigitalTwin.tsx` | all |
| Optimizer | `pages/Optimizer.tsx` | all |
| Renewables | `pages/Renewables.tsx` | all |
| Battery BESS | `pages/Battery.tsx` | all |
| Grid & Tariffs | `pages/Grid.tsx` | all |
| Scheduler | `pages/Scheduler.tsx` | all |
| Alerts | `pages/Alerts.tsx` | all |
| Reports | `pages/Reports.tsx` | all |
| Settings | `pages/Settings.tsx` | admin only |

Each tab is wrapped in `ProtectedRoute` (`components/ProtectedRoute.tsx`), which compares role ranks (admin 3 > operator 2 > viewer 1). This is a UI convenience only; the backend enforces authorization.

The console header shows a hard-coded site name ("Prestige University, Indore • MP Microgrid"), the WebSocket status pill, an IST clock, an alert bell (count of WebSocket alerts) and the user menu. `ConnectionBanner` sits below it.

## 3. State management

There is no global store library. The app uses two React contexts and local component state.

### `AuthContext` (`src/context/AuthContext.tsx`)

- Stores the token in `localStorage.surya_token` and the user JSON in `localStorage.surya_user`.
- On mount, if a token exists, calls `GET /api/v1/auth/me`; on failure it logs out.
- Exposes `login`, `signup`, `loginWithGoogle`, `logout`, `isAuthenticated`, `isAdmin` and `isOperator`.
- Listens for the `surya-auth-expired` window event that `services/api.ts` dispatches on a 401.
- `logout` clears local storage only; it does not call `/api/v1/auth/logout`. There is no token refresh.

### `WebSocketContext` (`src/context/WebSocketContext.tsx`)

- Connects only when authenticated. URL: `VITE_API_URL` with `http` replaced by `ws`, or the page's own host, then `/ws?token=<jwt>`.
- Sends `ping` every 15 s.
- Reconnects with exponential backoff, `min(1000·2^n + jitter, 30000)` ms, without limit. `reconnect()` resets the counter.
- Marks the data stale after 30 s without a message.
- Handles these messages:
  - `twin_update`: merged into `twinData`; `data.fluctuation` is stored as `liveFluctuation`.
  - `full_cycle`: stored as `latestCycle`.
  - `alert`: prepended to `activeAlerts` (cap 50). The backend never sends this type.

### `useLiveTwin(siteId)` (`src/hooks/useLiveTwin.ts`)

Fetches `apiTwin.getSiteTwin(siteId)` (`GET /api/v1/twin/live`), pushes it into the WebSocket context, then prefers live WebSocket data. It normalises the two aggregate field-name variants (REST `total_solar_kw` vs. WebSocket `total_solar_generation_kw`), or derives aggregates from the asset list.

## 4. API layer (`src/services/api.ts`)

`request<T>()` wraps `fetch`:

- Base URL is `import.meta.env.VITE_API_URL || ''` (same origin).
- Adds `Content-Type: application/json` and the Bearer token.
- On a `401` (except for login and signup) it clears storage and dispatches `surya-auth-expired`.
- Throws `ApiError(message, code, status, details)`, parsing both the backend error envelope and FastAPI's `detail`.

| Group | Functions used by the UI | Endpoint |
| --- | --- | --- |
| `apiAuth` | `login`, `signup`, `googleLogin`, `getMe` | `/api/v1/auth/*` |
| `apiTwin` | `getSiteTwin` | `GET /api/v1/twin/live`. The response is reshaped into a `SiteRead`, and **building tiers and battery limits are synthesised on the client**: the tier is inferred from the asset ID and the battery limits are hard-coded. |
| | `getAssetTelemetry` | `GET /api/v1/twin/assets/{id}/telemetry`. ⚠ **This route does not exist** (the backend route is `GET /api/v1/telemetry/series`). |
| `apiDecisions` | `listDecisions`, `getLatestCycle`, `getDecisionStats` | `/api/v1/decisions*` |
| `apiSettings` | control policy, alert thresholds, building tiers, VNM rules (get and update) | `/api/v1/settings/*` |
| `apiControl` | `forceCycle`, `setEmergencyStop` | `/api/v1/control/*` |
| `apiExport` | `getExportStats`, `getCsvDownloadUrl`, `getPdfDownloadUrl` | `/api/v1/export/*`. The download URLs put the token in a `?token=` query parameter, which the backend does not read. |
| `apiHealth` | `getSchedulerHealth` | `/health/scheduler` |
| `apiML` | `getLiveWeather`, `getFluctuationStatus`, `startFluctuationStream` | `/api/v1/forecast/weather-live`, `/api/v1/twin/fluctuate-stream/*` |

Fifteen further functions are defined but never called, for example `ingestTelemetry` (which targets a non-existent `/api/v1/twin/telemetry/ingest`), `acknowledgeCommand`, `updateBatteryConfig`, `resetToZero` and `applyPrediction`.

Two pages bypass this layer:

- `Overview.tsx:66` and `Forecast.tsx:192` call `fetch('/api/v1/forecast/48h…')` with a **relative URL**. On Vercel the request goes to Vercel, not the backend, and the SPA rewrite returns `index.html`.
  - Forecast then shows its client-side synthetic forecast.
  - Overview's forecast summary stays empty.
- They work only when the frontend and backend share an origin: the Vite proxy in development, or nginx in Docker.

## 5. Pages

| Page | Data sources | Notes |
| --- | --- | --- |
| Overview | `useLiveTwin`, WebSocket `latestCycle` and alerts, decisions latest and stats, relative forecast fetch, `forceCycle` (operator+) | MetricCards, `PowerFlowDiagram`, `FreshnessIndicator`, `MLTelemetryController` |
| Forecast | Relative `fetch /api/v1/forecast/48h` | SVG P10/P50/P90 chart. Falls back to `generateFallbackForecast` with hard-coded accuracy metrics. The region is fixed to `central_india_mp_indore`. |
| Digital Twin | `useLiveTwin` | Simulator iframe, building cards, filterable asset table, `AssetDetailModal` (its telemetry call returns 404) |
| Optimizer | `listDecisions`, `getDecisionStats`, `getLatestCycle` | `DecisionCard` list with paging by 10. The "alternatives" button always shows the **latest** cycle, not the selected decision's cycle. |
| Renewables / Battery / Grid | `useLiveTwin` | Grid shows hard-coded MPPKVVCL time-of-day tariffs (8.5 / 12.0 / 6.0 ₹, export 3.5) and a 0.82 emission factor, based on the browser's local hour |
| Scheduler | `getSchedulerHealth` every 15 s, `forceCycle` | Shows fabricated health values if the call fails |
| Alerts | WebSocket alerts plus three hard-coded demo alerts | Acknowledge is **local only** (no API call) |
| Reports | `getExportStats`, CSV/PDF links | Shows fabricated stats on error. Downloads fail with 401 (see §8). |
| Settings (admin) | `apiSettings`, `setEmergencyStop` | Tabs: Policy, VNM, Alerts, Buildings, Battery (read-only). Every GET has a hard-coded fallback; updates are optimistic and errors are ignored. |
| Login / Signup | `AuthContext`, `GoogleSignInButton` | Login has a one-click demo admin button with credentials in the source |
| Landing | none | Marketing page: GSAP and Lenis scroll animations (desktop ≥ 768 px, no reduced motion) and a before/after campus image wipe |

## 6. Component reference

| Component | File | Purpose | Key props / behaviour |
| --- | --- | --- | --- |
| `MLTelemetryController` | `components/MLTelemetryController.tsx` | Live weather, physics baseline and fluctuation panel shown on six pages | Props `siteId`, `currentRenewableKw`, `currentDemandKw`, `className`, `onRefreshState` (unused). **On mount, if the stream is not running, it calls `POST /twin/fluctuate-stream/start`**, so any viewer can start it. Falls back to hard-coded values. |
| `PowerFlowDiagram` | `components/PowerFlowDiagram.tsx` | Icon-based energy-flow view | `solarKw`, `windKw`, `demandKw`, `batteryKw` (+ discharge), `batterySoc`, `netGridKw` (+ import) |
| `BatteryGauge` | `components/BatteryGauge.tsx` | SVG SoC ring | `socPercent`, `reserveFloor`, `minSoc`, `maxSoc`, `powerKw`, `healthPercent`, `temperatureCelsius` |
| `MetricCard` | `components/MetricCard.tsx` | KPI tile | `title`, `value`, `unit`, `subtitle`, `icon`, `trend`, `badge` |
| `FreshnessIndicator` | `components/FreshnessIndicator.tsx` | Live or stale pill | `isStale`, `stalenessSeconds`, `lastUpdate` |
| `ConnectionBanner` | `components/ConnectionBanner.tsx` | WebSocket state banner with a reconnect button | reads `WebSocketContext` |
| `DecisionCard`, `AlternativesModal` | `components/` | Decision log entry; scored alternatives | |
| `AssetDetailModal` | `components/AssetDetailModal.tsx` | Asset detail plus recent telemetry table | Calls the non-existent telemetry route |
| `BuildingCard`, `AlertItem`, `StatusBadge` (`QualityBadge`, `SeverityBadge`, `OperationalStatusBadge`) | `components/` | Display components | |
| `EmergencyStopModal` | `components/EmergencyStopModal.tsx` | Asks for a reason, calls `onConfirm(active, reason)` | |
| `VNMConfigForm` | `components/VNMConfigForm.tsx` | Edit VNM sharing ratios | `onSave` |
| `GoogleSignInButton` | `components/GoogleSignInButton.tsx` | Loads `accounts.google.com/gsi/client` and renders the GSI button | Needs `VITE_GOOGLE_CLIENT_ID`; otherwise shows "Google sign-in is not configured yet." |
| `ProtectedRoute` | `components/ProtectedRoute.tsx` | Client-side role gate | `requiredRole` |
| `SuryaMark` | `components/SuryaMark.tsx` | Logo | |

**Unused code:**

- `components/landing/*` (14 files of an older landing page), `components/core/*`, `MLComparisonModal`, `data/heroSlides.ts`.
- The `tailwind-merge` dependency, the Tailwind `brand` palette, and several images in `public/` (`hero-bg.jpg`, `mp_dark.png`, `landing/*.png`, ...).

## Fallback and mock data

When an API call fails, these pages display **hard-coded values that look real**:

- Alerts: `INITIAL_DEMO_ALERTS`.
- Forecast: `generateFallbackForecast`.
- Reports: fallback stats.
- Scheduler: fallback health, including `cyc-manual-demo-01`.
- Settings: fallback configs.
- `MLTelemetryController`: default numbers.
- Overview: fallback coverage, CO₂ and SoC.

Keep this in mind when debugging. A page that "works" may be showing fallback data. Check the browser's network tab.

## 7. Styling and responsiveness

- Dark slate/emerald theme built from Tailwind utilities. `index.css` defines console-scoped classes (`.surya-console`, `.surya-page`, `.surya-tabs`) for scrollbars, focus rings, a staggered page-enter animation, and `prefers-reduced-motion` overrides.
- The console uses the `sm`/`md`/`lg` breakpoints, a horizontally scrolling tab bar with edge fades, and a 1600 px maximum width.
- Landing animations are disabled below 768 px.
- `index.css` lists `Inter` first in the font stack, but no Inter font is loaded.

## 8. Known defects

These were verified by reading the source. They are also tracked in [limitations-and-roadmap.md](limitations-and-roadmap.md).

1. **CSV/PDF download returns 401.** `Reports.tsx` opens `/api/v1/export/csv?token=…` in a new tab. The backend only reads the `Authorization` header. The JWT also ends up in browser history and server logs.
2. **Asset telemetry modal returns 404**, because it calls `/api/v1/twin/assets/{id}/telemetry`.
3. **Forecast on Vercel** uses a relative URL and receives HTML (§4).
4. **Optimizer alternatives** always show the latest cycle.
5. **Alert acknowledge** does not persist.
6. **Viewers start the ML stream** through `MLTelemetryController`.

## 9. Build and deployment

| Target | How |
| --- | --- |
| Vercel | `vercel.json`: install with `cd frontend && npm ci && cd ../simulator && npm ci`, build with `cd frontend && npm run build:simulator && npm run build`, output `frontend/dist`. Set `VITE_API_URL` (backend URL) and `VITE_GOOGLE_CLIENT_ID` in the Vercel project. |
| Docker | `frontend/Dockerfile` has three stages: build the simulator (node 22), build the app (node 20), serve with `nginx:alpine` using `nginx/nginx.conf`. The build context is the repository root. |

The production build was verified on 2026-10-09: `tsc` reported no errors, 1945 modules were bundled, the JS chunk is 717.5 kB (203.9 kB gzip), and Vite warned that a chunk exceeds 500 kB. `npm run lint` passed with 0 warnings. See [testing.md](testing.md).

## 10. Extending the console

See [contributing.md](contributing.md#adding-a-console-page). In short: add the tab to the `NavTab` union and tab list in `App.tsx`, create `src/pages/<Name>.tsx`, add API calls to `services/api.ts` with types in `types/index.ts`, and use `useLiveTwin` or `useWebSocket` for live data.
