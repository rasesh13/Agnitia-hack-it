from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db, get_session_maker
from backend.services.agnitia_ml_forecaster import ForecastResponse, RegionInfo, ml_forecaster
from backend.services.ml_microgrid_sync import ml_sync_service
from training.step5_test_and_train_custom_region import train_and_evaluate_region

router = APIRouter(prefix="/api/v1/forecast", tags=["forecasting"])


class ApplyMLPredictionRequest(BaseModel):
    region_id: str = Field("central_india_mp_indore", description="Microgrid region model identifier")
    simulate_daylight_peak: bool = Field(True, description="Simulate daytime solar peak if current hour is evening")
    ghi_wm2: Optional[float] = Field(None, description="Optional custom GHI W/m²")
    wind_speed_mps: Optional[float] = Field(None, description="Optional custom wind speed m/s")
    temp_c: Optional[float] = Field(None, description="Optional custom ambient temperature °C")
    cloud_pct: Optional[float] = Field(None, description="Optional custom cloud cover %")


class TrainRegionRequest(BaseModel):
    region_id: str = Field(..., description="Unique slug for the region, e.g. 'central_india_mp_indore'")
    name: str = Field(..., description="Descriptive region name, e.g. 'Central India (Indore & Malwa Plateau)'")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    solar_pv_capacity_kw: float = Field(..., gt=0.0, description="Installed Solar capacity in kW")
    wind_capacity_kw: float = Field(..., gt=0.0, description="Installed Wind capacity in kW")
    grid_emission_factor: float = Field(0.74, description="kg CO2 per kWh regional grid factor")
    custom_file_path: Optional[str] = Field(None, description="Optional local path to custom SCADA CSV or Parquet")


@router.get("/regions", response_model=List[RegionInfo])
async def list_available_regions():
    """Retrieve all available national and regional renewable microgrid profiles."""
    return ml_forecaster.get_available_regions()


@router.get("/48h", response_model=ForecastResponse)
async def get_48h_forecast(region_id: str = "central_india_mp_indore"):
    """Retrieve 48-hour hourly forecasts comparing Baseline vs ML (LightGBM & XGBoost P10/P50/P90)
    for Prestige University, Indore (Malwa Microgrid).
    """
    return ml_forecaster.forecast_48h(region_id=region_id)


@router.get("/metrics")
async def get_forecast_metrics():
    """Retrieve test benchmark metrics comparing Baseline vs ML models."""
    return ml_forecaster.get_evaluation_metrics()


@router.post("/reload")
async def reload_models():
    """Hot-reload model checkpoints and evaluation metrics from disk."""
    ml_forecaster.reload()
    return {
        "status": "ok",
        "ready": ml_forecaster.is_ready(),
        "models_count": len(ml_forecaster.models),
    }


@router.post("/train-region")
async def train_new_region(payload: TrainRegionRequest):
    """Trigger automated weather ingestion, physics simulation, walk-forward validation,
    and multi-model training for any new region or coordinates.
    """
    try:
        from training.step5_test_and_train_custom_region import train_and_evaluate_region
        report = train_and_evaluate_region(
            region_id=payload.region_id,
            name=payload.name,
            lat=payload.lat,
            lon=payload.lon,
            solar_pv_capacity_kw=payload.solar_pv_capacity_kw,
            wind_capacity_kw=payload.wind_capacity_kw,
            grid_emission_factor=payload.grid_emission_factor,
            custom_file_path=payload.custom_file_path,
        )
        ml_forecaster.reload()
        return {
            "status": "success",
            "message": f"Region '{payload.name}' trained and validated successfully.",
            "report": report,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to train region: {str(e)}")


@router.get("/site-metrics")
async def get_site_sensor_metrics():
    """Retrieve fine-grained inverter and turbine sensor benchmarks (Plant 1 Inverter & Commercial Wind Turbine)."""
    site_metrics_file = Path(r"D:\codes\model files for agnitia hack it\site_models\site_evaluation_metrics.json")
    if site_metrics_file.exists():
        import json
        with open(site_metrics_file, "r") as f:
            return json.load(f)
    return {"message": "Site-level models not yet serialized."}


@router.post("/reset-to-zero")
async def reset_microgrid_to_zero(session: AsyncSession = Depends(get_db)):
    """Resets all live microgrid asset telemetry & active power to 0.0 kW (Pre-ML baseline)."""
    return await ml_sync_service.reset_to_zero(session=session, site_id=1)


@router.post("/apply-prediction")
async def apply_ml_prediction(
    payload: Optional[ApplyMLPredictionRequest] = None,
    session: AsyncSession = Depends(get_db),
):
    """Executes real-time LightGBM & XGBoost model inference and transforms all 0 values
    into real-life generation, demand, and storage dispatch setpoints.
    """
    req = payload or ApplyMLPredictionRequest()
    custom_w = {}
    if req.ghi_wm2 is not None:
        custom_w["ghi_wm2"] = req.ghi_wm2
    if req.wind_speed_mps is not None:
        custom_w["wind_speed_mps"] = req.wind_speed_mps
    if req.temp_c is not None:
        custom_w["temp_c"] = req.temp_c
    if req.cloud_pct is not None:
        custom_w["cloud_pct"] = req.cloud_pct

    return await ml_sync_service.apply_ml_prediction(
        session=session,
        site_id=1,
        region_id=req.region_id,
        custom_weather=custom_w or None,
        simulate_daylight_peak=req.simulate_daylight_peak,
    )


@router.get("/live-comparison")
async def get_live_comparison(
    region_id: str = "central_india_mp_indore",
    session: AsyncSession = Depends(get_db),
):
    """Returns a comprehensive comparison table showing how the ML model changes values
    from 0 to real-life predictions across each microgrid asset.
    """
    return await ml_sync_service.get_comparison_summary(
        session=session, site_id=1, region_id=region_id
    )


@router.post("/fluctuate-step")
async def step_live_fluctuation(
    region_id: str = "central_india_mp_indore",
    session: AsyncSession = Depends(get_db),
):
    """Generates a real-time stochastic physics fluctuation step sampled from the ML model distribution.
    Broadcasts the updated state over WebSocket and returns instantaneous micro-deltas.
    """
    return await ml_sync_service.generate_live_fluctuation_step(
        session=session, site_id=1, region_id=region_id
    )


@router.post("/fluctuate-stream/start")
async def start_fluctuation_stream(
    interval_seconds: float = 3.0,
    region_id: str = "central_india_mp_indore",
):
    """Starts the background continuous streaming task pulsing live ML fluctuations every interval_seconds."""
    session_factory = get_session_maker()
    return ml_sync_service.start_background_streaming(
        session_factory=session_factory,
        interval_seconds=interval_seconds,
        site_id=1,
        region_id=region_id,
    )


@router.post("/fluctuate-stream/stop")
async def stop_fluctuation_stream():
    """Stops the background continuous fluctuation streaming loop."""
    return ml_sync_service.stop_background_streaming()


@router.get("/fluctuate-stream/status")
async def get_fluctuation_stream_status():
    """Returns whether the continuous ML fluctuation stream is actively running."""
    return ml_sync_service.get_streaming_status()


@router.get("/weather-live")
async def get_live_weather(region_id: str = "central_india_mp_indore"):
    """Returns real-life weather from Open-Meteo API along with first-principles physics baselines."""
    weather = ml_forecaster.get_realtime_weather(region_id=region_id)
    ghi = float(weather.get("ghi_wm2", 0.0))
    wind_mps = float(weather.get("wind_speed_mps", 0.0))
    temp_c = float(weather.get("temp_c", 30.0))

    t_cell = temp_c + 0.03 * ghi
    temp_derate = 1.0 - 0.004 * max(0.0, t_cell - 25.0)
    solar_physics_kw = max(0.0, round(300.0 * (ghi / 1000.0) * 0.85 * temp_derate, 2))

    if wind_mps < 1.5:
        w_ratio = 0.0
    elif wind_mps < 12.0:
        w_ratio = (wind_mps**2.5 - 1.5**2.5) / (12.0**2.5 - 1.5**2.5)
    elif wind_mps < 25.0:
        w_ratio = 1.0
    else:
        w_ratio = 0.0
    wind_physics_kw = max(0.0, round(120.0 * w_ratio, 2))

    return {
        "region_id": region_id,
        "weather": weather,
        "physics_baseline": {
            "solar_physics_kw": solar_physics_kw,
            "wind_physics_kw": wind_physics_kw,
            "total_generation_kw": round(solar_physics_kw + wind_physics_kw, 2),
        },
        "streaming_status": ml_sync_service.get_streaming_status(),
    }





