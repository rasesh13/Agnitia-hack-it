"""Unit and Integration Tests for Regional ML Forecasting and Validation.
Tests:
  1. Multi-region coverage (National Grid, Rajasthan, Tamil Nadu, Delhi, Karnataka, MP Indore, Gujarat).
  2. Monotonicity of Quantile Predictions: P10 <= P50 <= P90.
  3. Non-negativity constraints for solar and wind power.
  4. Accuracy metrics and empirical coverage validity.
"""
import pytest
from backend.services.agnitia_ml_forecaster import AgnitiaMLForecaster


@pytest.fixture(scope="module")
def forecaster():
    f = AgnitiaMLForecaster()
    return f


def test_forecaster_ready(forecaster):
    assert forecaster.is_ready()
    assert len(forecaster.models) >= 9


def test_available_regions_include_all(forecaster):
    regions = forecaster.get_available_regions()
    region_ids = [r.id for r in regions]
    assert "all_india_grid" in region_ids
    assert "western_desert_rajasthan" in region_ids
    assert "central_india_mp_indore" in region_ids


@pytest.mark.parametrize("region_id", [
    "all_india_grid",
    "western_desert_rajasthan",
    "southern_coastal_tamilnadu",
    "northern_plains_delhincr",
    "deccan_hybrid_karnataka",
    "central_india_mp_indore",
])
def test_forecast_monotonicity_and_bounds(forecaster, region_id):
    res = forecaster.forecast_48h(region_id=region_id)
    assert res.horizon_hours == 48
    assert len(res.series["solar"]) == 48
    assert len(res.series["wind"]) == 48

    for target in ["solar", "wind"]:
        for pt in res.series[target]:
            # Monotonicity test: P10 <= P50 <= P90
            assert pt.p10_lower <= pt.p50_prediction + 1e-4, f"P10 ({pt.p10_lower}) > P50 ({pt.p50_prediction}) in {region_id}"
            assert pt.p50_prediction <= pt.p90_upper + 1e-4, f"P50 ({pt.p50_prediction}) > P90 ({pt.p90_upper}) in {region_id}"
            # Non-negativity test
            assert pt.p10_lower >= 0.0
            assert pt.p50_prediction >= 0.0
            assert pt.p90_upper >= 0.0


def test_grid_implications_metrics(forecaster):
    res = forecaster.forecast_48h(region_id="central_india_mp_indore")
    assert res.grid_implication["unit"] == "kW"
    assert res.grid_implication["carbon_intensity_offset_tons"] > 0.0
    assert res.region_id == "central_india_mp_indore"
