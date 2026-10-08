from datetime import datetime, timezone

import pytest

from backend.models.config import BatteryConfig, BuildingConfig, CriticalityTier
from backend.models.decision_log import DecisionType
from backend.models.telemetry import AssetCurrentState, TelemetryQuality
from backend.services.digital_twin_store import CampusAggregate
from backend.services.reliability_guard import (
    ReliabilityAssessment,
    ReliabilityGuard,
)


@pytest.fixture
def reliability_guard():
    return ReliabilityGuard()


@pytest.fixture
def sample_buildings():
    return [
        BuildingConfig(
            asset_id="bldg-crit",
            building_name="Campus Datacenter & Medical",
            criticality_tier=CriticalityTier.CRITICAL,
            peak_load_kw=50.0,
            flexible_load_policy="protected",
        ),
        BuildingConfig(
            asset_id="bldg-ess-base",
            building_name="Academic Block A",
            criticality_tier=CriticalityTier.ESSENTIAL,
            peak_load_kw=40.0,
            flexible_load_policy="protected",
        ),
        BuildingConfig(
            asset_id="bldg-ess-flex",
            building_name="Research Lab HVAC",
            criticality_tier=CriticalityTier.ESSENTIAL,
            peak_load_kw=30.0,
            flexible_load_policy="shiftable",
        ),
        BuildingConfig(
            asset_id="bldg-noncrit-flex",
            building_name="Recreation Center HVAC",
            criticality_tier=CriticalityTier.NON_CRITICAL,
            peak_load_kw=25.0,
            flexible_load_policy="curtailable",
        ),
        BuildingConfig(
            asset_id="bldg-noncrit-base",
            building_name="Parking & Garden Lighting",
            criticality_tier=CriticalityTier.NON_CRITICAL,
            peak_load_kw=15.0,
            flexible_load_policy="protected",
        ),
    ]


@pytest.fixture
def sample_battery_config():
    return {
        "batt-01": BatteryConfig(
            asset_id="batt-01",
            min_soc=10.0,
            max_soc=95.0,
            reserve_floor=25.0,
            max_charge_power_kw=100.0,
            max_discharge_power_kw=100.0,
            health_floor=70.0,
        )
    }


def test_battery_discharge_capacity(reliability_guard, sample_battery_config):
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)

    # Case 1: High SoC (80%) -> Plenty of usable economic capacity + reserve
    high_soc_state = {
        "batt-01": AssetCurrentState(
            asset_id="batt-01",
            operational_status="online",
            soc_percent=80.0,
            health_percent=95.0,
            temperature_celsius=30.0,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        )
    }
    usable, reserve = reliability_guard.calculate_battery_discharge_capacity(
        high_soc_state, sample_battery_config
    )
    assert usable > 0.0
    assert reserve == pytest.approx(15.0)  # (25 - 10)% of 100kW = 15kW

    # Case 2: In Reserve Zone (20% SoC, where min_soc=10% and reserve_floor=25%)
    reserve_soc_state = {
        "batt-01": AssetCurrentState(
            asset_id="batt-01",
            operational_status="online",
            soc_percent=20.0,
            health_percent=95.0,
            temperature_celsius=30.0,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        )
    }
    usable, reserve = reliability_guard.calculate_battery_discharge_capacity(
        reserve_soc_state, sample_battery_config
    )
    assert usable == 0.0  # Zero economic discharge allowed below reserve floor
    assert reserve > 0.0  # Available only for emergency backup

    # Case 3: Depleted battery at or below min_soc (8% SoC)
    depleted_state = {
        "batt-01": AssetCurrentState(
            asset_id="batt-01",
            operational_status="online",
            soc_percent=8.0,
            health_percent=95.0,
            temperature_celsius=30.0,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        )
    }
    usable, reserve = reliability_guard.calculate_battery_discharge_capacity(
        depleted_state, sample_battery_config
    )
    assert usable == 0.0
    assert reserve == 0.0


def test_battery_temperature_derating(reliability_guard, sample_battery_config):
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)
    hot_state = {
        "batt-01": AssetCurrentState(
            asset_id="batt-01",
            operational_status="online",
            soc_percent=80.0,
            health_percent=95.0,
            temperature_celsius=60.0,  # Hot (>55C)
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        )
    }
    usable_hot, _ = reliability_guard.calculate_battery_discharge_capacity(
        hot_state, sample_battery_config
    )

    normal_state = {
        "batt-01": AssetCurrentState(
            asset_id="batt-01",
            operational_status="online",
            soc_percent=80.0,
            health_percent=95.0,
            temperature_celsius=28.0,  # Normal
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        )
    }
    usable_normal, _ = reliability_guard.calculate_battery_discharge_capacity(
        normal_state, sample_battery_config
    )

    assert usable_hot == pytest.approx(usable_normal * 0.5, abs=0.05)


def test_deterministic_load_shedding_priority(
    reliability_guard, sample_buildings, sample_battery_config
):
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)

    # Asset current power states
    asset_states = {
        "bldg-crit": AssetCurrentState(
            asset_id="bldg-crit",
            operational_status="online",
            active_power_kw=50.0,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        ),
        "bldg-ess-base": AssetCurrentState(
            asset_id="bldg-ess-base",
            operational_status="online",
            active_power_kw=40.0,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        ),
        "bldg-ess-flex": AssetCurrentState(
            asset_id="bldg-ess-flex",
            operational_status="online",
            active_power_kw=30.0,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        ),
        "bldg-noncrit-flex": AssetCurrentState(
            asset_id="bldg-noncrit-flex",
            operational_status="online",
            active_power_kw=25.0,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        ),
        "bldg-noncrit-base": AssetCurrentState(
            asset_id="bldg-noncrit-base",
            operational_status="online",
            active_power_kw=15.0,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        ),
        "batt-01": AssetCurrentState(
            asset_id="batt-01",
            operational_status="online",
            soc_percent=20.0,  # In reserve zone
            health_percent=95.0,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        ),
    }

    # Total demand = 50 + 40 + 30 + 25 + 15 = 160 kW
    # Total supply = 100 kW solar, 0 kW usable battery, 0 kW grid (islanded)
    # Shortfall = 60 kW
    campus_agg = CampusAggregate(
        site_id=1,
        total_solar_kw=100.0,
        total_generation_kw=100.0,
        total_building_demand_kw=160.0,
    )

    assessment = reliability_guard.assess_campus_reliability(
        campus_aggregate=campus_agg,
        buildings=sample_buildings,
        asset_states=asset_states,
        battery_configs=sample_battery_config,
        grid_available=False,  # Islanded
    )

    assert assessment.is_secure is False
    assert assessment.is_emergency is True
    assert assessment.shortfall_kw == pytest.approx(60.0)
    assert len(assessment.shedding_recommendations) > 0

    recs = assessment.shedding_recommendations
    # Rank 1 must be non-critical flexible (bldg-noncrit-flex)
    assert recs[0].asset_id == "bldg-noncrit-flex"
    assert recs[0].priority_rank == 1
    assert recs[0].recommended_shed_kw == pytest.approx(25.0)

    # Rank 2 must be non-critical base (bldg-noncrit-base)
    assert recs[1].asset_id == "bldg-noncrit-base"
    assert recs[1].priority_rank == 2
    assert recs[1].recommended_shed_kw == pytest.approx(15.0)

    # Rank 3 must be essential flexible (bldg-ess-flex), shedding remaining 20 kW of 30 kW
    assert recs[2].asset_id == "bldg-ess-flex"
    assert recs[2].priority_rank == 3
    assert recs[2].recommended_shed_kw == pytest.approx(20.0)

    # Critical load must have 0 recommended shed
    crit_rec = next(r for r in recs if r.asset_id == "bldg-crit")
    assert crit_rec.recommended_shed_kw == pytest.approx(0.0)


def test_validate_candidate_action(
    reliability_guard, sample_battery_config
):
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)
    batt_state = {
        "batt-01": AssetCurrentState(
            asset_id="batt-01",
            operational_status="online",
            soc_percent=20.0,  # Below 25% reserve floor
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        )
    }

    # Normal non-emergency assessment
    normal_assessment = ReliabilityAssessment(
        is_secure=True,
        is_emergency=False,
        shortfall_kw=0.0,
        reserve_margin_kw=50.0,
        critical_load_covered=True,
        essential_load_covered=True,
    )

    # Economic discharge candidate below reserve floor must be rejected
    is_valid, reason = reliability_guard.validate_candidate_action(
        action_type="discharge",
        target_asset_id="batt-01",
        setpoint_kw=30.0,
        battery_configs=sample_battery_config,
        asset_states=batt_state,
        assessment=normal_assessment,
    )
    assert is_valid is False
    assert "reserve floor" in reason.lower()

    # Grid export during emergency shortfall must be rejected
    emergency_assessment = ReliabilityAssessment(
        is_secure=False,
        is_emergency=True,
        shortfall_kw=20.0,
        reserve_margin_kw=-20.0,
        critical_load_covered=True,
        essential_load_covered=False,
    )
    is_valid_export, export_reason = reliability_guard.validate_candidate_action(
        action_type="grid_export",
        target_asset_id="grid-incomer",
        setpoint_kw=50.0,
        battery_configs=sample_battery_config,
        asset_states=batt_state,
        assessment=emergency_assessment,
    )
    assert is_valid_export is False
    assert "prohibited" in export_reason.lower()


def test_generate_emergency_decisions(reliability_guard, sample_buildings):
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)
    asset_states = {
        b.asset_id: AssetCurrentState(
            asset_id=b.asset_id,
            operational_status="online",
            active_power_kw=b.peak_load_kw,
            telemetry_quality=TelemetryQuality.GOOD,
            observed_at=now,
            received_at=now,
        )
        for b in sample_buildings
    }
    batt_cfg = {
        "batt-01": BatteryConfig(
            asset_id="batt-01",
            min_soc=10.0,
            reserve_floor=25.0,
            max_discharge_power_kw=50.0,
        )
    }

    campus_agg = CampusAggregate(
        site_id=1,
        total_solar_kw=20.0,
        total_generation_kw=20.0,
        total_building_demand_kw=160.0,
    )

    assessment = reliability_guard.assess_campus_reliability(
        campus_aggregate=campus_agg,
        buildings=sample_buildings,
        asset_states=asset_states,
        battery_configs=batt_cfg,
        grid_available=False,
    )

    decisions = reliability_guard.generate_emergency_decisions(
        cycle_id="cycle-emerg-001",
        site_id=1,
        assessment=assessment,
    )

    assert len(decisions) > 0
    assert all(d.decision_type == DecisionType.RELIABILITY for d in decisions)
    assert all(d.actor == "system:reliability_guard" for d in decisions)
    assert all(d.confidence == 1.0 for d in decisions)
