# Team Contributions & AI Usage Disclosure

> **Transparency, Authorship Metrics, and Artificial Intelligence Collaboration Record**  
> Agnitia Hackathon 2026

---

## 1. Verified Git Commit Contributions

The project commit history encompasses **316 total commits** across 3 team contributors:

| Contributor | Commits | Primary Development Focus |
| :--- | :--- | :--- |
| **`rasesh13`** | 200 | 3D Campus Digital Twin (`simulator/`), SURYA Ops Android companion application (`mobile/`), operations console styling, and report downloads. |
| **`Kunal-669`** | 94 | Core architecture scaffolding, async database engines, digital twin store, multi-objective optimization engines (`cost`, `carbon`, `vnm`, `reliability`), and landing page hero motion. |
| **`daksh nagar`** | 22 | ML model integration, zero-to-real telemetry synchronization, live fluctuation WebSocket streaming, and regional NWP forecasting. |

*Metrics extracted from `git log --format='%an'` as of 2026-10-09.*

---

## 2. Team Architecture & Design Responsibilities

The team personally designed, engineered, and reviewed all core platform specifications:

- **System Architecture & VNM Physics**: Conceptualized the multi-tier campus microgrid hierarchy, the Virtual Net Metering (VNM) sharing conservation constraints ($\sum \alpha_i = 1.0$), and the Central Electricity Authority (CEA) carbon factor integration ($0.82\text{ kg CO}_2\text{e/kWh}$).
- **Safety & Reliability Constraints**: Defined the non-negotiable battery protection envelopes ($\le 0.5\text{C}$ C-rate limit, $20\%$ reserve floor, and $10\text{--}95\%$ State of Charge boundaries).
- **Physical Campus Modeling**: Handcrafted 3D structural models and campus site configurations representing Prestige University (Indore), VIT Bhopal, and regional institutions.
- **Operator User Experience**: Designed the console layout, plain-language operational status summaries, and emergency stop interlocks.

```text
TODO(team): Fill in specific individual role assignments for the live judging presentation:
- Team Lead & System Architect: [Name / Role]
- Optimization & Backend Engineer: [Name / Role]
- Full-Stack & 3D Simulation Engineer: [Name / Role]
```

---

## 3. AI Coding Assistant Disclosure

In the spirit of complete hackathon transparency and academic integrity, the team utilized AI coding assistants (including Antigravity / Gemini) during development:

### 3.1 Where AI Assistance Was Applied
1. **Initial Boilerplate Scaffolding**: Rapid generation of Pydantic v2 data models, SQLAlchemy 2.0 async mixins, and Alembic database migration scripts.
2. **Automated Test Generation**: Scaffolding parameterized test fixtures across `tests/backend/` to achieve high test coverage (133 tests).
3. **Frontend UI Utility Classes**: Generating Tailwind CSS component token structures and responsive layout classes for operations dashboards.
4. **Documentation & Specification Drafting**: Assisting in synthesizing OpenAPI endpoints, drafting Markdown runbooks, and generating Mermaid architecture diagrams.

### 3.2 Human Engineering & Code Verification
All architectural boundaries, mathematical formulations, optimization logic, and database schemas were personally directed, tested, and audited by the human engineering team. No code was deployed without running automated test suites and local end-to-end verification.

```text
TODO(team): Add any personal reflections on AI pair programming during the 36-hour hackathon.
```
