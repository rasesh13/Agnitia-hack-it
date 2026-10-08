from datetime import datetime, timedelta, timezone

import pytest

from backend.models.config import BuildingConfig, CriticalityTier
from backend.models.decision_log import DecisionType
from backend.models.telemetry import AssetCurrentState, TelemetryQuality
from backend.services.forecast_engine import ForecastInterval
from backend.services.load_advisor import (
    CampusLoadShiftPlan,
    LoadAdvisor,
)


@pytest.fixture
def advisor() -> LoadAdvisor:
    return LoadAdvisor()


@pytest.fixture
def base_time() -> datetime:
    return datetime(2026, 6, 21, 10, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def sample_buildings() -> list[BuildingConfig]:
    return [
        BuildingConfig(
            id=1,
            asset_id="bldg-01",
            building_name="Data Center",
            criticality_tier=CriticalityTier.CRITICAL,
            flexible_load_policy="protected",
            peak_load_kw=150.0,
        ),
        BuildingConfig(
            id=2,
            asset_id="bldg-02",
            building_name="HVAC Central Plant",
            criticality_tier=CriticalityTier.ESSENTIAL,
            flexible_load_policy="flexible",
            peak_load_kw=100.0,
        ),
        BuildingConfig(
            id=3,
            asset_id="bldg-03",
            building_name="EV Charging Hub",
            criticality_tier=CriticalityTier.NON_CRITICAL,
            flexible_load_policy="shiftable",
            peak_load_kw=50.0,
        ),
    ]


def test_is_load_flexible(advisor: LoadAdvisor, sample_buildings: list[BuildingConfig]):
    assert advisor.is_load_flexible(sample_buildings[0]) is False  # protected
    assert advisor.is_load_flexible(sample_buildings[1]) is True   # flexible
    assert advisor.is_load_flexible(sample_buildings[2]) is True   # shiftable

    b_none = BuildingConfig(
        id=4,
        asset_id="bldg-04",
        building_name="Admin",
        criticality_tier=CriticalityTier.NON_CRITICAL,
        flexible_load_policy=None,
    )
    assert advisor.is_load_flexible(b_none) is False


def test_generate_recommendations_flexible_only(
    advisor: LoadAdvisor,
    sample_buildings: list[BuildingConfig],
    base_time: datetime,
):
    # Active states
    states = {
        "bldg-01": AssetCurrentState(
            asset_id="bldg-01",
            telemetry_quality=TelemetryQuality.GOOD,
            operational_status="online",
            active_power_kw=120.0,
        ),
        "bldg-02": AssetCurrentState(
            asset_id="bldg-02",
            telemetry_quality=TelemetryQuality.GOOD,
            operational_status="online",
            active_power_kw=60.0,
        ),
        "bldg-03": AssetCurrentState(
            asset_id="bldg-03",
            telemetry_quality=TelemetryQuality.GOOD,
            operational_status="online",
            active_power_kw=30.0,
        ),
    }

    # Forecast with a high solar surplus window in 1 hour (at 11:00 UTC)
    forecasts = [
        ForecastInterval(
            interval_start=base_time + timedelta(minutes=0),
            interval_end=base_time + timedelta(minutes=15),
            total_generation_kw=50.0,
            campus_demand_kw=200.0,
            net_surplus_kw=-150.0,
            confidence=0.9,
        ),
        ForecastInterval(
            interval_start=base_time + timedelta(minutes=60),
            interval_end=base_time + timedelta(minutes=75),
            total_generation_kw=250.0,
            campus_demand_kw=100.0,
            net_surplus_kw=150.0,
            confidence=0.85,
        ),
    ]

    plan: CampusLoadShiftPlan = advisor.generate_recommendations(
        site_id=1,
        buildings=sample_buildings,
        asset_states=states,
        forecast_intervals=forecasts,
        peak_tariff_inr_per_kwh=10.0,
        solar_surplus_tariff_inr_per_kwh=4.0,
        grid_emission_factor_kg_per_kwh=0.8,
    )

    # bldg-01 (protected Data Center) must NOT have any recommendation
    # bldg-02 (HVAC) and bldg-03 (EV Hub) must have recommendations
    rec_assets = [r.load_asset_id for r in plan.recommendations]
    assert "bldg-01" not in rec_assets
    assert "bldg-02" in rec_assets
    assert "bldg-03" in rec_assets

    hvac_rec = next(r for r in plan.recommendations if r.load_asset_id == "bldg-02")
    assert hvac_rec.shiftable_power_kw == 60.0
    assert hvac_rec.energy_kwh == 60.0  # 60 kW * 1h
    assert hvac_rec.estimated_savings_inr == 360.0  # 60 kWh * (10 - 4)
    assert hvac_rec.estimated_carbon_reduction_kg == 48.0  # 60 kWh * 0.8
    assert hvac_rec.recommended_window_start == base_time + timedelta(minutes=60)
    assert "bldg-02" in hvac_rec.load_asset_id


def test_generate_recommendations_offline_and_low_loads(
    advisor: LoadAdvisor,
    sample_buildings: list[BuildingConfig],
    base_time: datetime,
):
    states = {
        # Offline asset
        "bldg-02": AssetCurrentState(
            asset_id="bldg-02",
            telemetry_quality=TelemetryQuality.MISSING,
            operational_status="offline",
            active_power_kw=80.0,
        ),
        # Low load (<5 kW)
        "bldg-03": AssetCurrentState(
            asset_id="bldg-03",
            telemetry_quality=TelemetryQuality.GOOD,
            operational_status="online",
            active_power_kw=3.0,
        ),
    }

    forecasts = [
        ForecastInterval(
            interval_start=base_time,
            interval_end=base_time + timedelta(minutes=15),
            total_generation_kw=200.0,
            campus_demand_kw=50.0,
            net_surplus_kw=150.0,
            confidence=0.9,
        )
    ]

    plan = advisor.generate_recommendations(
        site_id=1,
        buildings=sample_buildings,
        asset_states=states,
        forecast_intervals=forecasts,
    )
    assert len(plan.recommendations) == 0


def test_generate_decision_records(
    advisor: LoadAdvisor,
    sample_buildings: list[BuildingConfig],
    base_time: datetime,
):
    states = {
        "bldg-02": AssetCurrentState(
            asset_id="bldg-02",
            telemetry_quality=TelemetryQuality.GOOD,
            operational_status="online",
            active_power_kw=50.0,
        )
    }
    forecasts = [
        ForecastInterval(
            interval_start=base_time + timedelta(minutes=30),
            interval_end=base_time + timedelta(minutes=45),
            total_generation_kw=180.0,
            campus_demand_kw=80.0,
            net_surplus_kw=100.0,
            confidence=0.9,
        )
    ]

    plan = advisor.generate_recommendations(
        site_id=1,
        buildings=sample_buildings,
        asset_states=states,
        forecast_intervals=forecasts,
    )
    assert len(plan.recommendations) == 1

    records = advisor.generate_decision_records(plan, cycle_id="cycle-shift-1")
    assert len(records) == 1
    rec = records[0]
    assert rec.decision_type == DecisionType.LOAD_SHIFT
    assert rec.action == "recommend_shift"
    assert rec.setpoint_kw == 50.0
    assert rec.target_asset_id == "bldg-02"
    assert rec.expected_savings_inr > 0.0
    assert rec.carbon_impact_kg < 0.0  # carbon reduction is negative emissions
    assert "comfort_constraints" in rec.context_data
