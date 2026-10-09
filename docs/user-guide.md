# User Guide (Web Console)

A task-oriented guide for operators using the SURYA web console. For developer details, see [frontend.md](frontend.md).

---

## 1. Signing in

- **Email and password:** use **Sign up** to create an account. New accounts get the **viewer** role. The first account in an empty database becomes admin.
- **Continue with Google:** available when the deployment has Google sign-in configured. New Google accounts get the **operator** role.
- Sessions last 120 minutes by default. When a session expires you are returned to the login screen.
- **Sign out** clears the session from this browser.

## 2. Roles

| You can… | Viewer | Operator | Admin |
| --- | :-: | :-: | :-: |
| See all dashboards, decisions and reports | ✔ | ✔ | ✔ |
| Force an optimisation cycle (Overview, Scheduler) | | ✔ | ✔ |
| Open **Settings**: control policy, VNM, alert thresholds, building tiers; emergency stop | | | ✔ |

To change a user's role, an administrator updates the database (there is no user-management screen yet).

## 3. Console tour

The header shows the site, the **live connection** indicator (Live / Connecting / Reconnecting / Offline; "Stale" after 30 s without updates), the time in IST, alerts, and your account menu.

| Tab | What it is for |
| --- | --- |
| **Overview (Mission Control)** | Campus totals (solar, wind, demand, battery, grid), a power-flow diagram, the latest optimiser decision and a forecast summary. Operators can **force a cycle**. |
| **Forecast** | 48-hour solar, wind and demand forecast with P10–P90 bands against a baseline. |
| **Digital Twin** | Interactive 3D model of Prestige University (with full-screen and new-tab options), building cards, and a searchable asset table. Click an asset for details. |
| **Optimizer** | Decision log with reasons, expected savings and carbon impact. "Alternatives" shows the scored candidate strategies. |
| **Renewables / Battery BESS / Grid & Tariffs** | Focused views of generation, storage state of charge and health, and grid import/export with the time-of-day tariff. |
| **Scheduler** | Health of the automatic optimisation loop: last cycle, duration, failures, next run. |
| **Alerts** | Alert list; acknowledge an alert to mark it handled (currently saved only in your browser). |
| **Reports** | KPI summary for a date range, with CSV and PDF export. |
| **Settings** (admin) | Closed-loop toggle and cost/carbon weights, VNM sharing ratios, alert thresholds, building criticality tiers, battery limits (view only), and the **Emergency Stop**. |

## 4. Common tasks

### Run the optimiser now

Overview or Scheduler → **Force cycle** (operator or admin). A new decision appears in the Optimizer tab. If a cycle is already running you will be asked to retry.

### Engage or release the emergency stop

Settings → **Emergency Stop** → enter a reason (at least 3 characters) → confirm.

- Automated optimisation cycles are then recorded as *blocked*.
- The stop is recorded in the audit log.
- It is cleared if the server restarts.

### Change building priority

Settings → Buildings → choose **critical**, **essential** or **non-critical**. During a supply shortfall, non-critical buildings are recommended for shedding first.

### Export a report

Reports → choose dates → **CSV** or **PDF**. The download buttons currently fail with an authorisation error; ask an engineer to export with the API (see [troubleshooting.md](troubleshooting.md#csvpdf-download-opens-a-json-auth_required-error-confirmed)).

## 5. Understanding the numbers

- Live values update every few seconds. In the current deployment they come from SURYA's **weather-driven model**, not from metered hardware: real weather from Open-Meteo combined with forecast models and small random variation.
- The 3D simulator uses its own model and may show different figures from the dashboards.
- If a page cannot reach the server it may show **sample data**. Check that the header shows **Live** before relying on the numbers.

## 6. Mobile companion

The **SURYA Ops** Android app shows the same live status and decisions, and sends phone notifications for low battery, high grid import, offline assets, optimiser failures and emergency stop. See [mobile-app.md](mobile-app.md).
