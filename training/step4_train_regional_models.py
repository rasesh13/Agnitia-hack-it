"""STEP 4: Train Regional Weather-Informed Physics-ML Hybrid Models.
Trains site-specific quantile LightGBM models driven by real NWP weather variables
(GHI irradiance, DNI, wind speed, ambient temp, cloud cover, plus physical diurnal curves).

Covers all 4 operating regions:
  1. western_desert_rajasthan
  2. southern_coastal_tamilnadu
  3. northern_plains_delhincr
  4. deccan_hybrid_karnataka

Saves regional model checkpoints and benchmarks to:
  D:\\codes\\model files for agnitia hack it\\regional\\
"""
import json
import math
import time
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

DATA_DIR = Path(r"D:\codes\datasets for agnitia hack it\regional_weather")
MODEL_OUT_DIR = Path(r"D:\codes\model files for agnitia hack it\regional")
MODEL_OUT_DIR.mkdir(parents=True, exist_ok=True)


def simulate_physics_baseline(weather_df: pd.DataFrame, solar_cap_kw: float, wind_cap_kw: float) -> pd.DataFrame:
    """Compute physical expected generation from first principles."""
    df = weather_df.copy()

    # 1. Solar Physics: Plane of array GHI modulated by temperature derating
    # Standard STC: 1000 W/m2 at 25C. Cell temp approx T_ambient + 0.03 * GHI
    t_cell = df["temp_c"] + 0.03 * df["ghi_wm2"]
    temp_derate = 1.0 - 0.004 * np.maximum(0, t_cell - 25.0)  # -0.4%/C above 25C
    solar_physics_kw = solar_cap_kw * (df["ghi_wm2"] / 1000.0) * 0.85 * temp_derate
    df["solar_physics_kw"] = np.maximum(0.0, solar_physics_kw)

    # 2. Wind Physics: Piecewise cubic aerodynamic power curve
    # Cut-in: 3.5 m/s, Rated: 12.0 m/s, Cut-out: 25.0 m/s
    v = df["wind_speed_mps"]
    wind_ratio = np.zeros_like(v)
    mask_gen = (v >= 3.5) & (v < 12.0)
    wind_ratio[mask_gen] = (v[mask_gen]**3 - 3.5**3) / (12.0**3 - 3.5**3)
    wind_ratio[(v >= 12.0) & (v < 25.0)] = 1.0
    wind_physics_kw = wind_cap_kw * wind_ratio
    df["wind_physics_kw"] = np.maximum(0.0, wind_physics_kw)

    # 3. Add realistic weather turbulence / cloud passage residuals
    np.random.seed(42)
    cloud_attenuation = 1.0 - (df["cloud_pct"] / 100.0) * 0.35
    df["actual_solar_kw"] = np.maximum(0.0, df["solar_physics_kw"] * cloud_attenuation * (1.0 + np.random.normal(0, 0.04, len(df))))
    df["actual_wind_kw"] = np.maximum(0.0, df["wind_physics_kw"] * (1.0 + np.random.normal(0, 0.06, len(df))))

    return df


def engineer_regional_features(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    hour = data.index.hour
    month = data.index.month
    dayofyear = data.index.dayofyear

    data["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    data["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    data["month_sin"] = np.sin(2 * np.pi * month / 12)
    data["month_cos"] = np.cos(2 * np.pi * month / 12)

    # Lags for NWP weather
    for col in ["ghi_wm2", "wind_speed_mps", "temp_c"]:
        data[f"{col}_lag1"] = data[col].shift(1)
        data[f"{col}_lag24"] = data[col].shift(24)
        data[f"{col}_roll6_mean"] = data[col].shift(1).rolling(6, min_periods=1).mean()

    return data.dropna()


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    denom = np.where(y_true == 0, 1.0, y_true)
    mape = np.mean(np.abs((y_true - y_pred) / denom)) * 100.0
    r2 = r2_score(y_true, y_pred)
    return {
        "MAE": round(float(mae), 2),
        "RMSE": round(float(rmse), 2),
        "MAPE": round(float(mape), 2),
        "R2": round(float(r2), 4),
    }


def train_regional_models():
    t0 = time.time()
    with open(DATA_DIR / "regional_profiles.json", "r") as f:
        profiles = json.load(f)

    all_regional_results = {}

    for region_id, meta in profiles.items():
        print(f"\n==========================================")
        print(f"Training Regional Models for: {meta['name']}")
        print(f"==========================================")

        parquet_path = DATA_DIR / f"{region_id}_weather_2024.parquet"
        weather_df = pd.read_parquet(parquet_path)

        ground_truth = simulate_physics_baseline(
            weather_df,
            solar_cap_kw=meta["solar_pv_capacity_kw"],
            wind_cap_kw=meta["wind_capacity_kw"],
        )

        feat_df = engineer_regional_features(ground_truth)

        # 80-20 Train-Test Split (last 2.5 months test)
        split_idx = int(len(feat_df) * 0.8)
        train_df = feat_df.iloc[:split_idx]
        test_df = feat_df.iloc[split_idx:]

        feature_cols = [
            "hour_sin", "hour_cos", "month_sin", "month_cos",
            "ghi_wm2", "dni_wm2", "dhi_wm2", "wind_speed_mps", "temp_c", "cloud_pct",
            "solar_physics_kw", "wind_physics_kw",
            "ghi_wm2_lag1", "ghi_wm2_lag24", "ghi_wm2_roll6_mean",
            "wind_speed_mps_lag1", "wind_speed_mps_lag24", "wind_speed_mps_roll6_mean",
            "temp_c_lag1", "temp_c_lag24", "temp_c_roll6_mean",
        ]

        X_train, X_test = train_df[feature_cols], test_df[feature_cols]

        region_metrics = {}

        for target, cap in [("solar", meta["solar_pv_capacity_kw"]), ("wind", meta["wind_capacity_kw"])]:
            y_train = train_df[f"actual_{target}_kw"].values
            y_test = test_df[f"actual_{target}_kw"].values
            physics_baseline = test_df[f"{target}_physics_kw"].values

            # Physical Baseline metrics
            b_metrics = compute_metrics(y_test, physics_baseline)

            # Quantile models
            preds = {}
            for alpha, q_name in [(0.1, "p10"), (0.5, "p50"), (0.9, "p90")]:
                m = lgb.LGBMRegressor(
                    objective="quantile",
                    alpha=alpha,
                    n_estimators=250,
                    learning_rate=0.05,
                    num_leaves=25,
                    random_state=42,
                    n_jobs=-1,
                )
                m.fit(X_train, y_train)
                pred = np.clip(m.predict(X_test), 0.0, cap * 1.05)
                preds[q_name] = pred
                joblib.dump(m, MODEL_OUT_DIR / f"{region_id}_{target}_{q_name}.joblib")

            # Monotonicity
            preds["p50"] = np.maximum(preds["p10"], preds["p50"])
            preds["p90"] = np.maximum(preds["p50"], preds["p90"])

            ml_metrics = compute_metrics(y_test, preds["p50"])
            in_band = (y_test >= preds["p10"]) & (y_test <= preds["p90"])
            cov = round(float(np.mean(in_band) * 100.0), 2)

            print(f"[{target.upper()}] Physical Baseline: {b_metrics}")
            print(f"[{target.upper()}] Quantile ML (P50):  {ml_metrics} | Coverage [P10-P90]: {cov}%")

            region_metrics[target] = {
                "capacity_kw": cap,
                "baseline_metrics": b_metrics,
                "ml_metrics": ml_metrics,
                "coverage_pct": cov,
                "sample_test": {
                    "timestamps": [t.isoformat() for t in test_df.index[-48:]],
                    "actual": [round(float(v), 2) for v in y_test[-48:]],
                    "baseline": [round(float(v), 2) for v in physics_baseline[-48:]],
                    "p10": [round(float(v), 2) for v in preds["p10"][-48:]],
                    "p50": [round(float(v), 2) for v in preds["p50"][-48:]],
                    "p90": [round(float(v), 2) for v in preds["p90"][-48:]],
                }
            }

        all_regional_results[region_id] = {
            "name": meta["name"],
            "grid_emission_factor": meta["grid_emission_factor"],
            "targets": region_metrics,
        }

    # Save summary
    with open(MODEL_OUT_DIR / "regional_evaluation_metrics.json", "w") as f:
        json.dump(all_regional_results, f, indent=2)

    print(f"\n==========================================")
    print(f"ALL REGIONAL MODELS TRAINED in {time.time()-t0:.1f}s!")
    print(f"Checkpoints and evaluation reports written to: {MODEL_OUT_DIR}")
    print(f"==========================================")


if __name__ == "__main__":
    train_regional_models()
