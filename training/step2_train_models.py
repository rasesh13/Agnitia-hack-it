"""STEP 2: Train Multi-Horizon Solar, Wind, and Demand Forecasting Models.
Multi-Model Comparison & Quantile Uncertainty Pipeline:
  1. Baseline Model (Diurnal Persistence / Physics Heuristic)
  2. LightGBM Quantile Models (P10 lower bound, P50 median, P90 upper bound)
  3. XGBoost Quantile Models (P10 lower bound, P50 median, P90 upper bound)
  4. Accuracy metrics: MAE, RMSE, MAPE, R^2, and [P10, P90] Empirical Coverage Rate

Saves all artifacts directly to:
  D:\\codes\\model files for agnitia hack it\\
"""
import json
import math
import os
import time
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb

DATA_PATH = Path(r"D:\codes\model files for agnitia hack it\processed\hourly_energy_2021_2025.parquet")
MODEL_DIR = Path(r"D:\codes\model files for agnitia hack it")
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineer robust time-series, astronomical, and autoregressive lag features."""
    data = df.copy()

    # Physical clean-up: clamp night solar SCADA outages (zenith <= 0 / night hours) to 0.0
    night_mask = (data.index.hour < 5) | (data.index.hour > 19)
    data.loc[night_mask, "solar_mw"] = 0.0

    # Temporal cyclic embeddings
    hour = data.index.hour
    dayofweek = data.index.dayofweek
    dayofyear = data.index.dayofyear
    month = data.index.month

    data["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    data["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    data["month_sin"] = np.sin(2 * np.pi * month / 12)
    data["month_cos"] = np.cos(2 * np.pi * month / 12)
    data["dayofweek"] = dayofweek
    data["is_weekend"] = (dayofweek >= 5).astype(int)

    # Astronomical clear-sky solar potential heuristic based on solar zenith angle
    lat_rad = math.radians(23.5)  # Central India reference latitude
    decl = 23.45 * (math.pi / 180.0) * np.sin(np.radians(360.0 * (284 + dayofyear) / 365.0))
    hour_angle = np.radians(15.0 * (hour - 12))
    cos_zenith = np.sin(lat_rad) * np.sin(decl) + np.cos(lat_rad) * np.cos(decl) * np.cos(hour_angle)
    data["clear_sky_potential"] = np.maximum(0, cos_zenith)

    # Autoregressive Lags & Rolling Windows (using values known >= 24h prior to prevent data leakage)
    for target in ["solar_mw", "wind_mw", "demand_mw"]:
        data[f"{target}_lag24"] = data[target].shift(24)
        data[f"{target}_lag48"] = data[target].shift(48)
        data[f"{target}_lag168"] = data[target].shift(168)  # 1 week ago

        lag24_series = data[target].shift(24)
        data[f"{target}_roll24_mean"] = lag24_series.rolling(24, min_periods=1).mean()
        data[f"{target}_roll24_std"] = lag24_series.rolling(24, min_periods=1).std().fillna(0)
        data[f"{target}_roll24_max"] = lag24_series.rolling(24, min_periods=1).max()
        data[f"{target}_roll24_min"] = lag24_series.rolling(24, min_periods=1).min()

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


def train_target_models(df_feat: pd.DataFrame, target: str, feature_cols: list[str]):
    print(f"\n==========================================")
    print(f"Training Multi-Model Suite for Target: {target}")
    print(f"==========================================")

    # Time-based out-of-sample split: last 180 days (6 months) as unseen test set
    split_date = df_feat.index.max() - pd.Timedelta(days=180)
    train_df = df_feat[df_feat.index < split_date]
    test_df = df_feat[df_feat.index >= split_date]

    X_train = train_df[feature_cols]
    y_train = train_df[target].values
    X_test = test_df[feature_cols]
    y_test = test_df[target].values

    print(f"Training samples: {len(X_train):,}, Out-of-sample test samples: {len(X_test):,}")

    # 1. Baseline Model: 24h Diurnal Persistence (y_pred = target_lag24)
    baseline_pred = test_df[f"{target}_lag24"].values
    if target == "solar_mw":
        baseline_pred = np.where(test_df["clear_sky_potential"] <= 0.01, 0.0, np.clip(baseline_pred, 0, None))
    baseline_metrics = compute_metrics(y_test, baseline_pred)
    print(f"1. Baseline (24h Persistence) -> {baseline_metrics}")

    # 2. LightGBM Quantile Models (P10, P50, P90)
    lgb_models = {}
    lgb_preds = {}
    for alpha, q_name in [(0.1, "p10"), (0.5, "p50"), (0.9, "p90")]:
        print(f"   [LightGBM] Fitting quantile: {q_name} (alpha={alpha})...")
        model = lgb.LGBMRegressor(
            objective="quantile",
            alpha=alpha,
            n_estimators=350,
            learning_rate=0.04,
            num_leaves=31,
            max_depth=6,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X_train, y_train)
        lgb_models[q_name] = model
        pred = model.predict(X_test)
        if target == "solar_mw":
            pred = np.where(test_df["clear_sky_potential"] <= 0.01, 0.0, np.clip(pred, 0, None))
        elif target == "wind_mw":
            pred = np.clip(pred, 0, None)
        lgb_preds[q_name] = pred

    # Enforce quantile monotonicity: p10 <= p50 <= p90
    lgb_preds["p50"] = np.maximum(lgb_preds["p10"], lgb_preds["p50"])
    lgb_preds["p90"] = np.maximum(lgb_preds["p50"], lgb_preds["p90"])

    lgb_metrics = compute_metrics(y_test, lgb_preds["p50"])
    lgb_in_band = (y_test >= lgb_preds["p10"]) & (y_test <= lgb_preds["p90"])
    lgb_coverage = round(float(np.mean(lgb_in_band) * 100.0), 2)
    print(f"2. LightGBM (P50) -> {lgb_metrics} | Coverage [P10-P90]: {lgb_coverage}%")

    # 3. XGBoost Quantile Models (P10, P50, P90)
    xgb_models = {}
    xgb_preds = {}
    for alpha, q_name in [(0.1, "p10"), (0.5, "p50"), (0.9, "p90")]:
        print(f"   [XGBoost] Fitting quantile: {q_name} (alpha={alpha})...")
        model = xgb.XGBRegressor(
            objective="reg:quantileerror",
            quantile_alpha=alpha,
            n_estimators=250,
            learning_rate=0.04,
            max_depth=5,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X_train, y_train)
        xgb_models[q_name] = model
        pred = model.predict(X_test)
        if target == "solar_mw":
            pred = np.where(test_df["clear_sky_potential"] <= 0.01, 0.0, np.clip(pred, 0, None))
        elif target == "wind_mw":
            pred = np.clip(pred, 0, None)
        xgb_preds[q_name] = pred

    # Enforce quantile monotonicity
    xgb_preds["p50"] = np.maximum(xgb_preds["p10"], xgb_preds["p50"])
    xgb_preds["p90"] = np.maximum(xgb_preds["p50"], xgb_preds["p90"])

    xgb_metrics = compute_metrics(y_test, xgb_preds["p50"])
    xgb_in_band = (y_test >= xgb_preds["p10"]) & (y_test <= xgb_preds["p90"])
    xgb_coverage = round(float(np.mean(xgb_in_band) * 100.0), 2)
    print(f"3. XGBoost (P50)  -> {xgb_metrics} | Coverage [P10-P90]: {xgb_coverage}%")

    # Save models to disk
    for q in ["p10", "p50", "p90"]:
        joblib.dump(lgb_models[q], MODEL_DIR / f"{target}_lgb_{q}.joblib")
        joblib.dump(xgb_models[q], MODEL_DIR / f"{target}_xgb_{q}.joblib")

    print(f"Checkpoints saved to {MODEL_DIR}")

    return {
        "baseline_metrics": baseline_metrics,
        "ml_metrics": lgb_metrics,  # LightGBM metrics
        "lgb_metrics": lgb_metrics,
        "xgb_metrics": xgb_metrics,
        "coverage_pct": lgb_coverage,
        "lgb_coverage_pct": lgb_coverage,
        "xgb_coverage_pct": xgb_coverage,
        "test_sample": {
            "timestamps": [t.isoformat() for t in test_df.index[-72:]],
            "actual": [round(float(v), 2) for v in y_test[-72:]],
            "baseline": [round(float(v), 2) for v in baseline_pred[-72:]],
            "p10": [round(float(v), 2) for v in lgb_preds["p10"][-72:]],
            "p50": [round(float(v), 2) for v in lgb_preds["p50"][-72:]],
            "p90": [round(float(v), 2) for v in lgb_preds["p90"][-72:]],
            "xgb_p10": [round(float(v), 2) for v in xgb_preds["p10"][-72:]],
            "xgb_p50": [round(float(v), 2) for v in xgb_preds["p50"][-72:]],
            "xgb_p90": [round(float(v), 2) for v in xgb_preds["p90"][-72:]],
        },
    }


def main():
    t0 = time.time()
    print("Loading unified SCADA energy dataset...")
    df = pd.read_parquet(DATA_PATH)
    print(f"Loaded {len(df):,} hourly records from {df.index.min()} to {df.index.max()}")

    print("Building temporal, astronomical, and autoregressive lag features...")
    df_feat = build_features(df)
    print(f"Feature set engineered: {df_feat.shape[0]:,} rows × {df_feat.shape[1]} columns")

    feature_cols = [
        "hour_sin", "hour_cos", "month_sin", "month_cos", "dayofweek", "is_weekend",
        "clear_sky_potential",
        "solar_mw_lag24", "solar_mw_lag48", "solar_mw_lag168",
        "solar_mw_roll24_mean", "solar_mw_roll24_std", "solar_mw_roll24_max", "solar_mw_roll24_min",
        "wind_mw_lag24", "wind_mw_lag48", "wind_mw_lag168",
        "wind_mw_roll24_mean", "wind_mw_roll24_std", "wind_mw_roll24_max", "wind_mw_roll24_min",
        "demand_mw_lag24", "demand_mw_lag48", "demand_mw_lag168",
        "demand_mw_roll24_mean", "demand_mw_roll24_std", "demand_mw_roll24_max", "demand_mw_roll24_min",
    ]

    with open(MODEL_DIR / "feature_metadata.json", "w") as f:
        json.dump({"feature_columns": feature_cols}, f, indent=2)

    results = {}
    for target in ["solar_mw", "wind_mw", "demand_mw"]:
        results[target] = train_target_models(df_feat, target, feature_cols)

    eval_report = {
        "dataset": "All-India SCADA 2021-2025 (Hourly Unified)",
        "rows_trained": len(df_feat),
        "features": feature_cols,
        "models_benchmarked": [
            "Diurnal Persistence Baseline (Lag-24h)",
            "LightGBM Quantile Regressors (P10/P50/P90)",
            "XGBoost Quantile Regressors (P10/P50/P90)",
        ],
        "results": results,
    }

    report_path = MODEL_DIR / "evaluation_metrics.json"
    with open(report_path, "w") as f:
        json.dump(eval_report, f, indent=2)

    print(f"\n==========================================")
    print(f"ALL MULTI-MODEL SUITES TRAINED in {time.time()-t0:.1f}s!")
    print(f"Checkpoints and benchmark reports stored at: {MODEL_DIR}")
    print(f"==========================================")


if __name__ == "__main__":
    main()
