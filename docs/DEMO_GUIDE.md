# SURYA Demo Guide & Judge Walkthrough

> **Interactive Click Paths, 3-Minute Hackathon Pitch Script, and Technical Judge FAQ**

---

## 1. Step-by-Step Judge Walkthrough

Follow this 5-minute tour to experience all core capabilities of the SURYA platform.

### Step 1: Sign In & Authentication
1. Navigate to **[http://localhost:5173](http://localhost:5173)** (or cloud preview [https://surya-sim.vercel.app](https://surya-sim.vercel.app)).
2. Click **Sign In** in the top navigation bar (or append `/#login` to the URL).
3. Enter credentials:
   - **Email**: `admin@surya-energy.com`
   - **Password**: `AdminSecret123!`
   *(Or click "Continue with Google" if configured).*
4. **Expected Result**: Successfully redirected to **Mission Control** with an active JWT session.

### Step 2: Mission Control Overview
1. Locate the top **Plain-Language Campus Status Banner** (e.g. *“Campus operating on 68% clean energy — Battery buffering solar surplus”*).
2. Inspect the **Power Flow Diagram**: Shows real-time animated power transfer between Solar PV, Wind, Battery, Utility Grid, and Campus Academic Blocks.
3. Toggle the **Technical Details** switch in the Live Readings card to view Modbus register quality flags (`good`, `< 5s age`).
4. **Expected Result**: Real-time power balance holds: $P_{\text{solar}} + P_{\text{wind}} + P_{\text{bess}} + P_{\text{grid}} = P_{\text{load}}$.

### Step 3: Interactive 3D Digital Twin
1. Click the **Digital Twin** tab in the top navigation.
2. Interact with the 3D campus model of Prestige University, Indore:
   - Left-click and drag to rotate the campus camera.
   - Right-click to pan; scroll to zoom in on rooftop solar panels and helical wind turbines.
3. Inspect the building telemetry overlays displaying active wattage per campus block.
4. **Expected Result**: Smooth 3D WebGL rendering embedded directly inside the operations console.

### Step 4: 48-Hour ML & NWP Generation Forecast
1. Click the **ML Forecasting** tab.
2. Observe the interactive **Generation Forecast Spline Chart**:
   - Hover over the curve to inspect the interactive crosshair at specific Indian Standard Time (IST) hours.
   - Observe the **Quantile Uncertainty Bands**: P10 (conservative lower bound), P50 (median prediction), and P90 (upper potential).
3. Review the **Live Weather Telemetry Panel** (Open-Meteo GHI, DNI, ambient temperature, wind speed).
4. Review the **Model Comparison Table** (Physics Baseline vs. LightGBM vs. XGBoost).
5. **Expected Result**: Realistic diurnal bell curve peaking around solar noon (12:00–13:00 IST).

### Step 5: Optimizer Decision Timeline & Explainability
1. Click the **Optimizer** tab.
2. Inspect the latest decision card:
   - Read the **Plain-Language Engineering Rationale** justifying why the winning strategy was selected over competing alternatives.
   - Review the **Rejected Alternatives Table** showing why high-cost or high-carbon candidates were rejected.
3. Click the **Force Optimization Cycle** button.
4. **Expected Result**: An immediate dispatch cycle is evaluated and broadcast over WebSockets, updating the decision timeline in sub-second time.

### Step 6: Virtual Net Metering & Control Settings
1. Click the **Settings** tab.
2. In the **Control Policy** panel:
   - Adjust the **Cost vs. Carbon Weight Slider** ($w_{\text{cost}} + w_{\text{carbon}} = 1.0$).
   - Click **Save Policy**.
3. Inspect the **Virtual Net Metering (VNM) Sharing Rules**:
   - Note the building allocation ratios strictly summing to $100.0\%$.
4. **Expected Result**: The scheduler immediately updates its scoring weights on-the-fly without requiring a service restart.

### Step 7: ESG Carbon Accounting & Report Downloads
1. Click the **Reports** tab.
2. Review the cumulative metrics: Total Generation (kWh), Net Carbon Displaced (kg CO2e), Peak Demand Arbitrage Savings (INR).
3. Click **Download CSV Audit Spreadsheet**: Downloads an RFC 4180 compliant CSV file.
4. Click **Download PDF Executive Summary**: Downloads a formatted executive PDF report generated via ReportLab with data quality disclosures.

---

## 2. 3-Minute Hackathon Pitch Script

### Minute 1: The Problem & The Indian Campus Context
> *"Good morning, judges. Across India, academic institutions, industrial estates, and hospital campuses are under immense pressure to achieve Net Zero while facing skyrocketing operational electricity costs. Campuses face peak Time-of-Day tariffs reaching up to ₹11.50 per unit, strict Virtual Net Metering sharing quotas across departmental meters, and severe battery degradation risks from uncontrolled cycling.*  
> *Most campus managers rely on passive monitoring portals that only tell you what happened yesterday. None of them autonomously orchestrate generation, storage, and loads in real time. That is why we built **SURYA: Smart Unified Renewable Yield Automation**."*

### Minute 2: The Solution & Live Product Demonstration
> *"SURYA is an automated microgrid operations platform. Let's look at Mission Control right now: our Digital Twin aggregates real-time power flows from rooftop solar, helical wind turbines, and utility connections.*  
> *Behind this dashboard is our multi-objective optimization engine. It takes live NWP weather data from Open-Meteo, generates 48-hour multi-horizon quantile forecasts (P10, P50, P90), and evaluates dispatch setpoints every 60 seconds.*  
> *Crucially, SURYA is completely explainable: for every single setpoint, the operator sees a plain-language justification, mathematical cost-versus-carbon scores calibrated to the Central Electricity Authority's 0.82 kg CO2 factor, and a transparent list of rejected alternatives.*  
> *When intermittent solar surplus occurs, our Virtual Net Metering solver guarantees a mathematically exact 100% allocation across academic and hostel blocks."*

### Minute 3: Engineering Rigor & Production Scalability
> *"Reliability unconditionally wins over economic dispatch in SURYA. Our Reliability Guard enforces hard C-rate bounds of 0.5C to double battery cycle life, reserves a non-negotiable 20% floor for critical research labs, and features an instant Emergency Stop interlock.*  
> *Under the hood, SURYA is built with a production-grade stack: FastAPI asynchronous backend with Alembic migrations, React 18 TypeScript single-page app, embedded Three.js 3D simulation, and 133 automated unit and integration tests with a 100% pass rate.*  
> *SURYA turns campus microgrids from passive consumers into autonomous, resilient clean energy virtual power plants. Thank you, and we welcome your questions."*

---

## 3. Top 10 Technical Judge Questions & Code-Backed Answers

#### Q1: "Is the data shown on the dashboard real or simulated?"
**Answer**: SURYA is architected with a decoupled adapter boundary (`backend/adapters/`) supporting Modbus TCP/RTU, MQTT, and REST. For this hackathon demonstration, the backend seeds an authentic, physically calibrated profile of Prestige University, Indore (`backend/db/seed_demo_data.py`). The ML forecaster calls the real **Open-Meteo live weather API** for solar irradiance and wind speeds at the campus coordinates. The 3D campus model in `simulator/` is an interactive visualization tool.

#### Q2: "How do you protect battery life from excessive cycling?"
**Answer**: In `backend/services/reliability_guard.py`, we enforce three non-violable physical constraints:
1. **Hard C-rate limit**: Maximum continuous charge/discharge is capped at $\le 0.5\text{C}$ ($200\text{ kW}$ for our $500\text{ kWh}$ pack).
2. **State of Charge bounds**: $10.0\% \le SoC \le 95.0\%$.
3. **Emergency Reserve Floor**: $20.0\%$ SoC is locked strictly for Tier 1 Critical loads and cannot be discharged for economic tariff arbitrage.

#### Q3: "What happens if external weather forecasting APIs go down?"
**Answer**: In `backend/services/agnitia_ml_forecaster.py`, weather API calls are cached with a 60-second TTL. If external network access fails, the engine gracefully falls back to an internal analytical diurnal solar curve ($P_{\text{solar}} \propto \sin^2$) and regional wind distributions, tagging the output confidence as degraded.

#### Q4: "How does your Virtual Net Metering (VNM) solver work?"
**Answer**: Implemented in `backend/services/vnm_optimizer.py`. Indian state regulations require inter-building solar credits to follow registered sharing ratios. We enforce $\sum \alpha_i = 1.000$. We support two strategies: *Proportional* (distributes energy strictly by configured ratio) and *Critical-First* (allocates solar credits to Tier 1 Critical buildings up to their measured interval consumption first, distributing remaining surplus proportionally).

#### Q5: "What prevents race conditions or overlapping optimization runs?"
**Answer**: In `backend/services/scheduler.py`, the `DecisionScheduler` uses an `asyncio.Lock()`. If an optimization cycle takes longer than 60 seconds due to heavy database load, the scheduler skips the overlapping execution and logs the event, guaranteeing zero concurrent dispatch setpoint collisions.

#### Q6: "How does the Emergency Stop (E-Stop) function?"
**Answer**: Calling `POST /api/v1/control/emergency-stop` instantly sets `emergency_stop_active=True`, forces `closed_loop_enabled=False`, resets BESS discharge to `0.0 kW` (Standby), and generates a permanent audit event requiring a mandatory operator justification string (`backend/api/routes_control.py`).

#### Q7: "What carbon emissions baseline do you use?"
**Answer**: In `backend/services/carbon_optimizer.py`, we use the official Central Electricity Authority (CEA) baseline carbon factor of $0.82\text{ kg CO}_2\text{e/kWh}$ for the Indian national grid.

#### Q8: "How does the WebSocket communication work?"
**Answer**: In `backend/ws/websocket_manager.py`, clients connect to `/ws?token=<jwt>` passing their access token. Handshakes validate token signatures and extract RBAC claims. Telemetry updates (`twin_update`), cycle completions (`full_cycle`), and alarms (`alert`) are broadcast using asynchronous non-blocking fan-out.

#### Q9: "Why didn't you build this in Python Streamlit?"
**Answer**: Streamlit is an excellent rapid prototyping tool, but it re-runs entire scripts on user interaction, creates high latency for concurrent users, and cannot support bidirectional sub-second WebSocket telemetry or multi-role authentication. SURYA uses a decoupled FastAPI + React 18 TypeScript architecture to meet enterprise scalability, sub-second latency, and responsive mobile viewport requirements.

#### Q10: "How can judges verify the codebase?"
**Answer**: Run `python -m pytest -q` in the terminal to verify all **133 automated unit and integration tests** pass, or run `docker compose up --build` to inspect the full multi-tier containerized stack locally.
