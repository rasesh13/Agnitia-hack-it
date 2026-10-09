# SURYA Machine Learning & Weather Forecasting Pipeline

> **Multi-Horizon Quantile Uncertainty Modeling, NWP Weather Ingestion, and Fallback Behaviors**

---

## 1. Overview & Objectives

In microgrid management, dispatching battery storage and allocating solar credits requires lookahead visibility. SURYA incorporates an ML forecasting pipeline designed to predict:
1. **Rooftop Solar PV Yield (kW)**
2. **Helical Wind Generation (kW)**
3. **Campus Facility Power Demand (kW)**

Forecast horizons span **24 to 48 hours** at 1-hour resolution, providing **Quantile Uncertainty Bands** (P10, P50, P90) rather than deterministic point estimates alone.

---

## 2. Feature Engineering & Numerical Weather Prediction (NWP)

Feature transformation is implemented in [`training/step2_train_models.py`](../training/step2_train_models.py) and [`backend/services/agnitia_ml_forecaster.py`](../backend/services/agnitia_ml_forecaster.py).

### 2.1 Astronomical & Solar Geometry Features
- **Solar Zenith Angle**: Evaluated using campus latitude ($\phi = 22.72^\circ\text{N}$ for Indore) and solar declination:
  $$\delta = 23.45^\circ \times \sin\left(\frac{360}{365} \times (284 + d)\right)$$
  $$\cos \theta_z = \sin \phi \sin \delta + \cos \phi \cos \delta \cos \omega$$
- **Clear-Sky Solar Potential**: $\max(0, \cos \theta_z)$
- **Nighttime Filtering**: Hard clamping to $0.0\text{ kW}$ between 19:00 and 05:00 IST to eliminate nighttime sensor noise.

### 2.2 Temporal Cyclic Embeddings
- `hour_sin` / `hour_cos`: $\sin\left(\frac{2\pi \cdot h}{24}\right)$, $\cos\left(\frac{2\pi \cdot h}{24}\right)$
- `month_sin` / `month_cos`: $\sin\left(\frac{2\pi \cdot m}{12}\right)$, $\cos\left(\frac{2\pi \cdot m}{12}\right)$
- `is_weekend`: Binary flag distinguishing low-demand academic campus weekend periods.

### 2.3 Live NWP Meteorological Variables
Fetched in real-time from the **Open-Meteo Weather API** using campus GPS coordinates:
- **Global Horizontal Irradiance (GHI)** ($\text{W/m}^2$)
- **Direct Normal Irradiance (DNI)** ($\text{W/m}^2$)
- **Surface Ambient Temperature ($^\circ\text{C}$)** (used for PV module thermal efficiency derating: $-0.4\%/^\circ\text{C}$ above $25^\circ\text{C}$)
- **Wind Speed at 10m & 100m ($\text{m/s}$)** (used with cut-in, rated, and cut-out turbine wind curves)
- **Relative Humidity & Cloud Cover ($\%$)**

### 2.4 Autoregressive Lags & Rolling Statistics
To prevent data leakage during multi-horizon lookaheads, all autoregressive features are offset by $\ge 24\text{ hours}$:
- `lag24`, `lag48`, `lag168` (same hour 1 day, 2 days, and 1 week prior)
- 24-hour rolling statistics: `roll24_mean`, `roll24_std`, `roll24_max`, `roll24_min`

---

## 3. Multi-Model Architecture & Quantile Loss

SURYA compares three model archetypes across all target metrics:

| Model Archetype | Framework | Objective Function / Method | Role |
| :--- | :--- | :--- | :--- |
| **Physics Heuristic Baseline** | Pure Python | Diurnal persistence & astronomical clear-sky equation | Control baseline |
| **LightGBM Quantile Regressors** | LightGBM 4.3 | Pinball / Quantile Loss ($\alpha \in \{0.1, 0.5, 0.9\}$) | Fast gradient boosted trees |
| **XGBoost Quantile Regressors** | XGBoost 2.0 | `reg:quantileerror` ($\alpha \in \{0.1, 0.5, 0.9\}$) | Deep tree ensembles |

### Quantile Uncertainty Bands
Rather than predicting single scalar numbers, models output probabilistic bounds:
- **P10 (10th percentile)**: Lower confidence bound; used by the `ReliabilityGuard` to calculate minimum guaranteed spinning reserve.
- **P50 (50th percentile)**: Median expected production; used by the `DispatchOptimizer` for cost arbitrage.
- **P90 (90th percentile)**: Upper potential; used for battery pre-curtailment and surplus absorption planning.

---

## 4. Evaluation Metrics & Benchmarks

Models are evaluated on holdout campus SCADA datasets using five core metrics:

1. **Mean Absolute Error (MAE)**:
   $$\text{MAE} = \frac{1}{n} \sum_{i=1}^n |y_i - \hat{y}_i|$$
2. **Root Mean Squared Error (RMSE)**:
   $$\text{RMSE} = \sqrt{\frac{1}{n} \sum_{i=1}^n (y_i - \hat{y}_i)^2}$$
3. **Mean Absolute Percentage Error (MAPE)**:
   $$\text{MAPE} = \frac{100\%}{n} \sum_{i=1}^n \left|\frac{y_i - \hat{y}_i}{y_i}\right| \quad (\text{for } y_i > 0)$$
4. **Coefficient of Determination ($R^2$)**:
   $$R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$$
5. **Empirical Coverage Rate**: Percentage of actual observations falling within $[P10, P90]$ (Target: $80\% \pm 5\%$).

---

## 5. Fallback Mechanisms & Runtime Limitations

### 5.1 Weather API Caching
The Open-Meteo API is queried with an in-memory 60-second Time-To-Live (TTL) cache (`backend/services/agnitia_ml_forecaster.py`). If the API is unreachable, the cached forecast is extended.

### 5.2 Analytical Diurnal Fallback
If pre-trained model files are not found (for instance, on cloud deployments where external training directories are omitted), the service automatically executes its **Analytical Diurnal Fallback Engine**:
- **Solar**: Modulated using a smooth squared sine diurnal curve peaking at solar noon:
  $$P_{\text{solar}}(t) = P_{\text{rated}} \times \sin^2\left(\frac{\pi(t - 6)}{12}\right) \quad \text{for } 6 \le t \le 18$$
- **Wind**: Evaluated using diurnal wind oscillation models ($18\text{ kW}$ peak evening velocity).
- **P10/P90 Multipliers**: Computed as $-12\%$ and $+12\%$ of median expectation, ensuring consistent quantile envelope behavior without runtime exceptions.

### 5.3 Documented Technical Limitations
1. **Local Model Directory Dependency**: Model training scripts in `training/` save serialized `.joblib` files to `D:\codes\model files for agnitia hack it`. When deployed in container environments without this mounted volume, the forecaster runs in the verified analytical fallback mode.
2. **Sudden Cloud Cover (Ramp Events)**: Hourly resolution NWP data may lag sub-hourly cloud formation events (e.g. monsoon squalls). In production, Modbus inverter telemetry updates override the forecast every 3 seconds.
