"""Test Suite for ML Zero-to-Real Transformation & Digital Twin Synchronization."""
import pytest
from backend.db.database import get_session_maker, init_db
from backend.models.digital_twin import Asset
from backend.models.telemetry import AssetCurrentState
from backend.services.agnitia_ml_forecaster import ml_forecaster
from backend.services.ml_microgrid_sync import ml_sync_service
from sqlalchemy import select


@pytest.mark.asyncio
async def test_predict_realtime_point():
    """Verify LightGBM model feature ingestion, inference, and quantile ordering."""
    pred = ml_forecaster.predict_realtime_point(
        region_id="central_india_mp_indore",
        simulate_daylight_peak=True,
    )
    assert "ml_predictions" in pred
    assert "asset_setpoints" in pred
    assert "flow_summary" in pred

    solar = pred["ml_predictions"]["solar"]
    wind = pred["ml_predictions"]["wind"]
    demand = pred["ml_predictions"]["demand"]

    # Verify predictions are positive realistic values
    assert solar["p50_prediction_kw"] > 0
    assert wind["p50_prediction_kw"] > 0
    assert demand["p50_prediction_kw"] > 0

    # Verify quantile ordering [P10 <= P50 <= P90]
    assert solar["p10_lower_kw"] <= solar["p50_prediction_kw"]
    assert solar["p50_prediction_kw"] <= solar["p90_upper_kw"]
    assert wind["p10_lower_kw"] <= wind["p50_prediction_kw"]
    assert wind["p50_prediction_kw"] <= wind["p90_upper_kw"]

    # Verify asset allocations sum correctly
    setpoints = pred["asset_setpoints"]
    assert setpoints["solar-pv-01"] > 0
    assert setpoints["solar-pv-02"] > 0
    assert setpoints["wind-wt-01"] > 0
    assert setpoints["bldg-eng"] > 0
    assert setpoints["bldg-admin"] > 0
    assert setpoints["bldg-hostel"] > 0


@pytest.mark.asyncio
async def test_reset_to_zero_and_apply_ml_prediction():
    """Verify complete cycle: Reset to 0.0 kW baseline -> Apply real-life ML predictions."""
    await init_db()
    session_factory = get_session_maker()

    async with session_factory() as session:
        # Step 1: Reset to Zero Baseline
        reset_res = await ml_sync_service.reset_to_zero(session, site_id=1)
        assert reset_res["state_mode"] == "ZERO_BASELINE"
        assert reset_res["aggregate"]["total_generation_kw"] == 0.0
        assert reset_res["aggregate"]["total_solar_kw"] == 0.0
        assert reset_res["aggregate"]["total_wind_kw"] == 0.0
        assert reset_res["aggregate"]["total_building_demand_kw"] == 0.0

        # Verify all database assets are 0.0 kW
        stmt = select(AssetCurrentState)
        states = list((await session.execute(stmt)).scalars().all())
        assert len(states) >= 8
        for s in states:
            assert s.active_power_kw == 0.0

        # Step 2: Apply Real-Life ML Model Prediction
        apply_res = await ml_sync_service.apply_ml_prediction(
            session=session,
            site_id=1,
            region_id="central_india_mp_indore",
            simulate_daylight_peak=True,
        )
        assert apply_res["state_mode"] == "ML_REAL_LIFE_PREDICTED"
        assert apply_res["post_ml_real_values"]["total_solar_kw"] > 0
        assert apply_res["post_ml_real_values"]["total_wind_kw"] > 0
        assert apply_res["post_ml_real_values"]["total_demand_kw"] > 0
        assert apply_res["aggregate"]["total_generation_kw"] > 0

        # Verify DB assets now hold positive real-life predicted setpoints
        stmt_updated = select(AssetCurrentState).where(AssetCurrentState.asset_id == "solar-pv-01")
        solar_state = (await session.execute(stmt_updated)).scalar_one()
        assert solar_state.active_power_kw > 50.0

        # Step 3: Get Comparison Summary
        comp_res = await ml_sync_service.get_comparison_summary(session, site_id=1)
        assert "comparison_matrix" in comp_res
        assert comp_res["comparison_matrix"]["zero_baseline"]["solar_kw"] == 0.0
        assert comp_res["comparison_matrix"]["ml_prediction"]["solar_kw"] > 0.0
        assert len(comp_res["assets"]) >= 8

        # Clean up: Return database to 0.0 kW baseline as instructed by user
        await ml_sync_service.reset_to_zero(session, site_id=1)


@pytest.mark.asyncio
async def test_generate_live_fluctuation_step():
    """Verify stochastic micro-fluctuation step bounds and BESS closed-loop compensation."""
    await init_db()
    session_factory = get_session_maker()

    async with session_factory() as session:
        # First ensure we have ML setpoints applied
        await ml_sync_service.apply_ml_prediction(
            session=session,
            site_id=1,
            region_id="central_india_mp_indore",
            simulate_daylight_peak=True,
        )

        step = await ml_sync_service.generate_live_fluctuation_step(
            session=session,
            site_id=1,
            region_id="central_india_mp_indore",
        )

        assert "fluctuation" in step
        fl = step["fluctuation"]
        assert "step" in fl
        assert "solar_kw" in fl
        assert "wind_kw" in fl
        assert "campus_demand_kw" in fl
        assert "battery_power_kw" in fl
        assert "net_grid_exchange_kw" in fl
        assert "event_description" in fl
        assert "bus_voltage_v" in fl
        assert "grid_frequency_hz" in fl

        # Values should be bounded within realistic physical thresholds
        assert 0.0 <= fl["solar_kw"] <= 300.0
        assert 0.0 <= fl["wind_kw"] <= 120.0
        assert 50.0 <= fl["campus_demand_kw"] <= 250.0
        assert 410.0 <= fl["bus_voltage_v"] <= 420.0
        assert 49.8 <= fl["grid_frequency_hz"] <= 50.2

        # Net grid exchange should be close to 0.0 kW due to BESS closed-loop compensation
        assert abs(fl["net_grid_exchange_kw"]) < 0.1

        # Reset back to zero baseline
        await ml_sync_service.reset_to_zero(session, site_id=1)

