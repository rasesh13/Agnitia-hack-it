# 3D Campus Simulator

`simulator/` is a standalone React 19 + three.js application that renders 3D digital-twin visualisations of 12 Indian campuses. The flagship campus is Prestige University, Indore. The web console embeds it in the Digital Twin tab.

> The simulator is a **visualisation with its own energy model**. It does **not** read SURYA backend telemetry. `simulator/README.md` predates the Prestige integration and describes the older VIT Bhopal / Rajasthan scope.

Related: [frontend.md](frontend.md) · [architecture.md](architecture.md)

---

## 1. Tooling

| Item | Value |
| --- | --- |
| Package | `vit-bhopal-energy-twin` 1.0.0 (plain JSX, no TypeScript) |
| Dependencies | react / react-dom ^19.2, three ^0.181, @react-three/fiber ^9.4, @react-three/drei ^10.7, lucide-react |
| Build | Vite ^8.2 with `base: "./"` (relative, so it works under `/simulator/`); manual chunks for three, drei, fiber, icons and react |
| Scripts | `dev` (`vite --host 0.0.0.0`, port 5173), `build`, `preview` (port 4173), `test` (`node --test tests/*.test.mjs`) |

```bash
cd simulator
npm ci
npm run dev    # http://127.0.0.1:5173/#prestige-university
npm test
```

## 2. Structure

- `src/main.jsx` → `src/App.jsx`, which routes on the URL hash:
  - No hash: `CampusDashboard.jsx`, a searchable list of campuses.
  - `#vit-bhopal`: the detailed VIT Bhopal scene (`CampusScene.jsx`, about 6.7k lines).
  - Any other campus ID: `RegionalCampusSimulator.jsx` and `RegionalCampusScene.jsx`. Prestige uses the bespoke models in `src/PrestigeCampus.jsx` (academic block, hostel towers, sports arena, gate).
- `src/campuses.js`: 12 campus definitions with coordinates and solar, wind and demand capacities.
- `src/energyIntelligence.js`: energy model covering PV wiring, turbine curve, BESS C-rate and reserve, diesel backup, losses, financial and carbon metrics.
- `src/weather.js`: weather scenarios (clear, monsoon, storm, winter, night) and live weather from **wttr.in**, with **Open-Meteo** as backup. Cached in `localStorage`, with an offline fallback.
- `EngineeringLab.jsx`, `engineeringEngine.js`, `useHazardSimulation.js`: hazard drills (overload, transformer fire, battery thermal, solar DC fire, wind overspeed, lightning).

## 3. Integration with the console

| Aspect | Implementation |
| --- | --- |
| Build into console | `npm --prefix frontend run build:simulator` writes to `frontend/public/simulator/` (git-ignored). Vercel's build command and the frontend Dockerfile both run it. |
| Embedding | `frontend/src/pages/DigitalTwin.tsx`: `<iframe src="/simulator/index.html?embed=1#prestige-university">`, with a full-screen toggle and an "open in new tab" link (`embed=0`) |
| URL parameters read by the simulator | `?embed=1`, `#<campusId>`, `?scenario=<clear\|monsoon\|storm\|winter\|night>`, `?view=<camera preset>`, `?hazard=<type>` |
| Simulator → parent | `postMessage({type: "surya:campus-telemetry", payload: {...}})` on every state change, and `{type: "surya:campus-selection"}`. Target origin is the referrer's origin, or `*`. |
| Parent → simulator | None |
| Console listener | **None.** The console ignores the simulator's messages. |

## 4. Tests

`node:test` suites:

- `tests/energyIntelligence.test.mjs`: about 16 tests.
- `tests/weather.test.mjs`: 3 tests.

Run them with `npm test` in `simulator/`. They were run during the documentation audit on 2026-10-09 (Node v25.6.0): **19 tests, 19 passed, 0 failed**.

## 5. Limitations

- Values are produced by the simulator's own model; they will not match the backend twin.
- Very large source files (`CampusScene.jsx`, `styles.css`), a heavy bundle and a raised chunk-size warning limit.
- Its README and package name are out of date.
- `wttr.in` and Open-Meteo are called directly from the browser, so the user's browser must be able to reach them.
