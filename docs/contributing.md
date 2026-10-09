# Contributing and Coding Standards

This guide combines contribution workflow and coding conventions. Items marked **(enforced)** are checked by tooling configured in the repository. Items marked **(observed)** are patterns the existing code follows. Items marked **(recommended)** are suggestions that nothing enforces today.

Related: [installation-and-setup.md](installation-and-setup.md) · [testing.md](testing.md) · [architecture.md](architecture.md)

---

## 1. Repository organisation

```text
backend/     FastAPI service (api, services, models, db, ws, adapters)
frontend/    React 18 web console (src/pages, src/components, src/context, src/services)
simulator/   React 19 + three.js 3D campus simulator (built into frontend/public/simulator)
mobile/      Capacitor Android app
training/    Offline ML training scripts
tests/backend/  pytest suite
docs/        Documentation (this folder); docs/legacy/ holds the original spec-era docs
nginx/       nginx config for the frontend container
spec.md, PLAN.md  Original specification and build plan (historical; partly superseded)
```

## 2. Workflow

- **Branching (observed):** the team commits directly to `main` with a linear history. **(recommended)** For larger changes, use short-lived feature branches (`feat/<topic>`, `fix/<topic>`) and fast-forward or squash merges.
- **Commit messages (observed):** Conventional-Commit style with scopes, for example `feat(auth): ...`, `fix(ml): ...`, `build(deploy): ...`, `chore(config): ...`, `test(ml): ...`. Keep commits small, with one reason each.
- **Pull requests (recommended):** describe the change, link related issues, list the commands you ran (tests, lint, build) and their results, and update the docs in `docs/` that describe the behaviour you changed.

## 3. Quality gates

| Check | Command | Status today |
| --- | --- | --- |
| Backend tests | `python -m pytest` | Requires `requirements.txt` installed; see [testing.md](testing.md) |
| Backend lint | `python -m ruff check backend tests` (line length 100, rules E/W/F/I/C/B, B008 ignored) **(enforced by config, not by CI)** | Currently reports errors; see [testing.md](testing.md) |
| Frontend types | `npm --prefix frontend run build` (`tsc` strict) | Passes |
| Frontend lint | `npm --prefix frontend run lint` (`--max-warnings 0`) | Passes |
| Simulator tests | `npm --prefix simulator test` | 19/19 pass |
| Mobile lint | `npm --prefix mobile run lint` (oxlint) | Not run in this audit |

There is no CI, so run these locally before pushing. **(recommended)** Add a GitHub Actions workflow that runs pytest, ruff, and the frontend build and lint.

## 4. Coding conventions

### Python (observed)

- Type hints everywhere; Pydantic v2 models with `ConfigDict(extra="forbid")` for request bodies and `from_attributes=True` for ORM reads.
- SQLAlchemy 2.0 typed models (`Mapped[...]`, `mapped_column`); timestamps via `utc_now()`.
- Names: `snake_case` functions and modules; `PascalCase` classes; `UPPER_SNAKE` settings; routers in `routes_<area>.py`.
- **Errors:** raise `HTTPException(status_code=..., detail={"code": "UPPER_SNAKE", "message": "...", "details": {...}})`. Never return ad-hoc error dicts. The middleware wraps the detail in the standard envelope.
- **Logging:** `logging.getLogger("surya.<area>")`; pass structured context with `extra={"event": ..., "site_id": ...}`.
- Settings are always read with `get_settings()`, never `os.environ`.

### TypeScript and React (observed)

- Function components and hooks; strict TypeScript; shared types in `src/types/index.ts`.
- All HTTP through `src/services/api.ts`. **Do not** call `fetch('/api/...')` directly (two pages do, and it breaks on Vercel).
- Tailwind utility classes; icons from `lucide-react`; the `@/` import alias.
- Names: `PascalCase.tsx` for components and pages; `useX.ts` for hooks.
- **(recommended)** Show an error state when an API call fails instead of inventing fallback numbers.

## 5. How-to recipes

### Adding an API endpoint

1. Pick or create `backend/api/routes_<area>.py`, using a router `APIRouter(prefix="/api/v1/<area>", tags=[...])`.
2. Define request and response models in `backend/models/schemas.py`, with `extra="forbid"` on inputs and range validators.
3. Add auth: `current_user: Annotated[User, Depends(require_viewer_or_above)]`, or operator/admin for mutations. **Every state-changing route needs a role guard.**
4. Put business logic in a service in `backend/services/` and keep the route thin. Use repositories for reusable queries.
5. For admin mutations, write an `AuditEvent` in the same transaction, as `routes_settings.py` does.
6. Register a new router in `create_app()` in `backend/main.py`.
7. Add tests in `tests/backend/test_routes_<area>.py`, following the in-memory SQLite and `dependency_overrides[get_db]` pattern in `test_routes_twin.py`.
8. Document the route in [api-reference.md](api-reference.md).

### Adding a database entity

1. Add the model in `backend/models/` and export it from `backend/models/__init__.py`, so Alembic and `create_all` can see it.
2. Create a migration: `alembic revision -m "add <thing>"` in `backend/db/migrations/versions/`, written by hand following the style of `002_telemetry_decisions.py`. Autogenerate is possible because `target_metadata` is set, but review its output.
   - Remember that enums are stored as **member names** ([database.md §5](database.md#5-enum-storage-database-vs-application)).
3. Run `alembic upgrade head` against Postgres. Development SQLite uses `create_all`.
4. If demo data needs it, update `seed_demo_data.py` and keep it idempotent.
5. Update [database.md](database.md) and the ER diagram.

### Adding a console page

1. Create `frontend/src/pages/<Name>.tsx`.
2. In `frontend/src/App.tsx`, add the key to the `NavTab` union, add an entry to the tab list (label and icon), and add a branch to the render chain inside `ProtectedRoute`.
3. Add API functions to `services/api.ts` and types to `types/index.ts`.
4. Use `useLiveTwin(1)` for live twin data and `useWebSocket()` for cycles and connection state.

### Adding a component

Place it in `frontend/src/components/`, type its props with an interface, and keep data fetching in pages or hooks unless the component is self-contained (as `AssetDetailModal` is).

### Adding an integration

- **External data source:** follow `get_realtime_weather`. Put it in a service with a timeout, caching and a fallback. Prefer `httpx.AsyncClient` over blocking `urllib` so the event loop stays free.
- **Hardware telemetry:** implement `EnergyAdapter` (`backend/adapters/base.py`). Create it from `Settings.ADAPTER_*` in the lifespan, call `start()`, and pass an async snapshot provider to `DecisionScheduler`.
  - The current `snapshot_provider` is called synchronously in `execute_cycle`, so an async `read_snapshot` needs a small change there.
  - Pass building, battery and VNM configs to `execute_cycle` so that all optimisers run.

## 6. Documentation expectations

- Update the matching file in `docs/` in the same change as the code.
- Mark planned behaviour as planned. Never document something the code does not do.
- Keep secrets out of docs and examples.

## 7. Review checklist

- [ ] Auth guard present on every new or changed mutating route.
- [ ] Input validated (types, ranges, enums) so that bad input gives 422, not 500.
- [ ] Alembic migration added for model changes.
- [ ] No blocking I/O in async paths.
- [ ] No new in-process global state that breaks with multiple workers, or the limitation is documented.
- [ ] Tests added or updated; pytest, ruff and the frontend build and lint run locally.
- [ ] No credentials, personal emails or machine-specific paths (such as `D:\...`) committed.
- [ ] Docs updated.
