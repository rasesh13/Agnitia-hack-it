# SURYA Documentation

The documentation describes the code as of commit `243b65c` (2026-10-09). Statements were checked against the source. Planned or partially implemented behaviour is labelled as such.

## Start here

| If you want to… | Read |
| --- | --- |
| Understand what SURYA is and how the pieces fit | [architecture.md](architecture.md) |
| Run it locally | [installation-and-setup.md](installation-and-setup.md) → [environment-configuration.md](environment-configuration.md) |
| Call the API | [api-reference.md](api-reference.md) |
| Use the console | [user-guide.md](user-guide.md) |
| Deploy it | [deployment.md](deployment.md) |
| Fix a problem | [troubleshooting.md](troubleshooting.md) |
| Contribute code | [contributing.md](contributing.md) → [testing.md](testing.md) |
| Know what is missing or broken | [limitations-and-roadmap.md](limitations-and-roadmap.md) · [security.md](security.md) |

## All documents

### System

- [architecture.md](architecture.md): components, communication, request lifecycle, data flow, process model, scaling.
- [workflows.md](workflows.md): decision cycle, ML fluctuation stream, emergency stop, reports, mobile alerting.
- [dependencies.md](dependencies.md): libraries and external services.

### Components

- [backend.md](backend.md): FastAPI app, startup, middleware, services, adapters, logging, concurrency.
- [frontend.md](frontend.md): React console, state, API layer, pages, components, known defects.
- [ml-and-forecasting.md](ml-and-forecasting.md): ML forecaster, model artifacts, training pipeline.
- [simulator.md](simulator.md): 3D campus simulator and how it is embedded.
- [mobile-app.md](mobile-app.md): SURYA Ops Android app and its on-device alert rules.

### Data and interfaces

- [api-reference.md](api-reference.md): all 60 HTTP routes and the WebSocket protocol.
- [database.md](database.md): schema, ER diagram, migrations, seed data, constraints.
- [authentication-and-authorization.md](authentication-and-authorization.md): login flows, JWT, roles.

### Operations

- [installation-and-setup.md](installation-and-setup.md)
- [environment-configuration.md](environment-configuration.md): every variable, including which ones are actually used.
- [deployment.md](deployment.md): Render, Vercel, Docker Compose.
- [testing.md](testing.md): test suites and the actual results of running them.
- [security.md](security.md): findings by severity.
- [troubleshooting.md](troubleshooting.md): problems, fixes and maintenance.

### Project

- [contributing.md](contributing.md): workflow, coding standards, how-to recipes, review checklist.
- [user-guide.md](user-guide.md)
- [limitations-and-roadmap.md](limitations-and-roadmap.md)
- [documentation-audit.md](documentation-audit.md): how this documentation was produced and verified.

### Diagrams (Mermaid sources)

[system-architecture](diagrams/system-architecture.mmd) · [request-lifecycle](diagrams/request-lifecycle.mmd) · [authentication-flow](diagrams/authentication-flow.mmd) · [database-relationships](diagrams/database-relationships.mmd) · [deployment-architecture](diagrams/deployment-architecture.mmd)

GitHub renders the copies embedded in the Markdown files. The `.mmd` files are for editing and for tools such as `mermaid-cli`.

### Historical

[`legacy/`](legacy/) holds the original `API.md`, `ARCHITECTURE.md` and `OPERATIONS.md`. They were written from `spec.md` and are kept for reference; parts of them describe behaviour that was never implemented. The root `spec.md` and `PLAN.md` are also historical.

## Terminology

| Term | Meaning in this codebase |
| --- | --- |
| Site | A campus (`sites` table). The demo uses site `1`. |
| Asset | Any energy device or building (`assets`): solar, wind, battery, building, grid, … |
| Digital twin | The latest state of every asset (`asset_current_state`) plus campus aggregates |
| Decision cycle | One run of the optimisation pipeline (`decision_cycles`), producing decisions and alternatives |
| Alternative | A scored candidate dispatch strategy that was considered |
| BESS | Battery energy storage system |
| VNM | Virtual net metering: allocating generated energy credits to buildings |
| E-stop | Emergency stop; blocks automated decision cycles |
| Fluctuation stream | Background task that refreshes twin values every 3 s from weather and ML |
