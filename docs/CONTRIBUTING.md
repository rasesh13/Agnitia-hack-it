# Contributing to SURYA

> **Local Development Guidelines, Code Quality Gates, and Conventional Commit Standards**

---

## 1. Local Development Setup

### 1.1 Prerequisites
- **Python**: 3.11 or 3.12
- **Node.js**: 20+ (LTS) or 22+
- **Docker & Docker Compose**: Optional for containerized deployment

### 1.2 Backend Setup
```bash
# 1. Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Apply database migrations
alembic upgrade head

# 4. Start local development server
uvicorn backend.main:app --reload --port 8000
```

### 1.3 Frontend Setup
```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Build 3D campus simulator into static public assets
npm run build:simulator

# 3. Start Vite dev server
npm run dev
# Running on http://localhost:5173
```

---

## 2. Quality Verification Gates

Before submitting changes, all code must pass the local verification checks:

```bash
# 1. Run backend automated test suite (must pass 100%)
python -m pytest -q

# 2. Run Python linting
python -m ruff check backend tests

# 3. Run frontend TypeScript linting
npm --prefix frontend run lint

# 4. Verify frontend production build
npm --prefix frontend run build
```

---

## 3. Conventional Commit Guidelines

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification used throughout the repository:

```text
<type>(<scope>): <short imperative description>
```

### Supported Types:
- **`feat`**: A new user-facing feature or API capability.
- **`fix`**: A bug fix or error correction.
- **`docs`**: Documentation creation or revisions.
- **`style`**: Visual styling, CSS token tweaks, or layout refinements without logic changes.
- **`refactor`**: Code restructuring without altering external functionality.
- **`test`**: Adding or updating unit/integration tests.
- **`chore`**: Tooling, dependencies, or configuration updates.

### Common Scopes:
- `auth`, `twin`, `forecast`, `optimizer`, `settings`, `control`, `export`, `landing`, `simulator`, `mobile`, `deps`.

### Examples:
- `feat(forecast): add 48h cubic spline curves with IST hour alignment`
- `fix(reports): download CSV and PDF reports with authenticated token`
- `docs(architecture): document exact mathematical optimization formulas`
