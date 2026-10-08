from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from backend.services.agnitia_ml_forecaster import ForecastResponse, RegionInfo, ml_forecaster

router = APIRouter(prefix="/api/v1/forecast", tags=["forecasting"])


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


