# ML and Forecasting

SURYA has two forecasting paths:

1. **Heuristic campus forecast** (`backend/services/forecast_engine.py`). Used inside every decision cycle: 4 h at 15 min resolution, built from a diurnal solar factor and persistence of current values. It needs no model files.
2. **ML forecaster** (`backend/services/agnitia_ml_forecaster.py`). LightGBM and XGBoost quantile models (P10/P50/P90) trained offline by the scripts in `training/`. It powers the `/api/v1/forecast/*` routes, the Forecast page and the live fluctuation stream.

Related: [workflows.md](workflows.md#ml-fluctuation-stream-the-source-of-live-values) · [api-reference.md](api-reference.md#10-forecasting-and-ml-apiv1forecast)

---

## 1. Model artifacts and loading

`AgnitiaMLForecaster._load_artifacts()` runs when `backend.services.agnitia_ml_forecaster` is imported (`ml_forecaster` is a module singleton). It reads from a **hard-coded absolute Windows path**:

```python
MODEL_DIR = Path(r"D:\codes\model files for agnitia hack it")
REGIONAL_DIR = MODEL_DIR / "regional"
```

| Artifact | Expected file |
| --- | --- |
| Grid models | `MODEL_DIR/{solar_mw,wind_mw,demand_mw}_{lgb,xgb}_{p10,p50,p90}.joblib` (18 files) |
| Indore regional models | `REGIONAL_DIR/central_india_mp_indore_{solar_lgb,solar,wind_lgb,wind}_{p10,p50,p90}.joblib` |
| Metrics | `MODEL_DIR/evaluation_metrics.json`, `REGIONAL_DIR/regional_evaluation_metrics.json` |
| Feature list | `MODEL_DIR/feature_metadata.json` |

**No model artifacts are committed to the repository.** On any machine without that directory, which includes Render, Docker and CI:

- `self.models` is filled with `DummyQuantileModel` instances. They predict a constant `50 × {0.85, 1.0, 1.15}` for P10/P50/P90.
- Metrics are replaced by `_generate_default_regional_metrics()` and `_generate_default_grid_metrics()`. These are **generated placeholder numbers, not evaluation results**.
- `is_ready()` still returns `true`.

`GET /api/v1/forecast/site-metrics` also reads a hard-coded `D:\...\site_models\site_evaluation_metrics.json`.

To use real models elsewhere, the path has to become configurable (see [limitations-and-roadmap.md](limitations-and-roadmap.md)). Then copy the artifact directory to the server and call `POST /api/v1/forecast/reload`.

## 2. Inference

| Method | Used by | Behaviour |
| --- | --- | --- |
| `forecast_48h(region_id)` | `GET /forecast/48h` | Hourly baseline vs. ML P10/P50/P90 for solar, wind and demand, plus generation alerts and grid implications |
| `predict_realtime_point(region_id, target_dt, custom_weather, simulate_daylight_peak)` | ML sync service | Feature engineering from current weather and time, then quantile prediction and per-asset setpoints (`asset_setpoints`, `flow_summary`) |
| `get_realtime_weather(region_id)` | ML sync, `GET /forecast/weather-live` | Open-Meteo `current=` fields (temperature, humidity, DNI, diffuse, shortwave/GHI, wind speed and direction, cloud cover), cached for 60 s. Falls back to the last value, then a time-of-day solar model. |
| `get_available_regions()` | `GET /forecast/regions` | `all_india_grid` plus the regions in the regional metrics |
| `get_evaluation_metrics()` | `GET /forecast/metrics` | `metrics["results"]` |

Regions with coordinates (`REGIONAL_COORDINATES`): Indore (300 kW solar / 120 kW wind), Gujarat, Tamil Nadu, Rajasthan, and an all-India reference.

## 3. Offline training pipeline (`training/`)

All scripts are run manually with Python, for example `python training/step2_train_models.py`, and hard-code input and output paths under `D:\codes\...`. They need `pandas`, `numpy`, `scikit-learn`, `lightgbm`, `xgboost` and `joblib` (all in `requirements.txt`).

| Script | Input | Output |
| --- | --- | --- |
| `step1_fast_extract.py` | Zip of monthly SCADA Excel files (electricity demand, solar and wind generation) | `processed/hourly_energy_2021_2025.parquet` |
| `step2_train_models.py` | That parquet file | Persistence baseline vs. LightGBM vs. XGBoost quantile models for `solar_mw`, `wind_mw`, `demand_mw`; `feature_metadata.json`; `evaluation_metrics.json` |
| `step3_fetch_regional_weather.py` | Open-Meteo **archive** API | Regional hourly weather and `regional_profiles.json` |
| `step4_train_regional_models.py` | Regional weather | Per-region LightGBM quantile models and `regional_evaluation_metrics.json` |
| `step5_test_and_train_custom_region.py` | Coordinates, or a custom CSV/Parquet file | Walk-forward validation (physics vs. LightGBM vs. XGBoost) and new regional models. Also importable: the API calls `train_and_evaluate_region`. Falls back to relative `datasets/` and `model_files/` folders when `D:\` is unavailable. |
| `step6_train_site_scada_models.py` | Plant 1 generation and weather CSVs, `Turbine_Data.csv` | Site-level inverter and turbine models plus `site_evaluation_metrics.json` |

The source datasets are not in the repository, and their provenance and licensing are not documented. Training results therefore cannot be reproduced from the repository alone.

## 4. Accuracy claims

The landing page and the legacy docs quote figures such as accuracy and CO₂ factors. **This audit could not verify any model accuracy figure**: the metrics files are not in the repository, and in deployed environments `/forecast/metrics` returns generated defaults. Treat displayed metrics as illustrative unless `models_count` from `POST /forecast/reload` shows that real models were loaded.

## 5. Testing

`tests/backend/test_regional_validation.py` and `test_ml_zero_to_real_sync.py` exercise the forecaster and the sync service. Both need the ML packages installed, and they run against the dummy models on machines without the artifacts. See [testing.md](testing.md).
