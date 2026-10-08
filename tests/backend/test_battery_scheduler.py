from datetime import datetime, timedelta, timezone

import pytest

from backend.models.config import BatteryConfig
from backend.models.decision_log import DecisionType
from backend.models.telemetry import AssetCurrentState, TelemetryQuality
from backend.services.battery_scheduler import (
    BatteryAction,
    BatteryScheduler,
)
from backend.services.forecast_engine import ForecastInterval


@pytest.fixture
def scheduler() -> BatteryScheduler:
    return BatteryScheduler()


@pytest.fixture
def default_config() -> BatteryConfig:
    return BatteryConfig(
        id=1,
        asset_id="batt-01",
        min_soc=10.0,
        max_soc=95.0,
        reserve_floor=25.0,
        max_charge_power_kw=100.0,
        max_discharge_power_kw=100.0,
        round_trip_efficiency=0.92,
        health_floor=70.0,
    )


@pytest.fixture
def base_state() -> AssetCurrentState:
    now = datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)
    return AssetCurrentState(
        asset_id="batt-01",
        telemetry_quality=TelemetryQuality.GOOD,
        operational_status="online",
        temperature_celsius=28.0,
        health_percent=95.0,
        soc_percent=60.0,
        observed_at=now,
        received_at=now,
    )


def test_operational_limits_nominal(
    scheduler: BatteryScheduler, base_state: AssetCurrentState, default_config: BatteryConfig
):
    limits = scheduler.calculate_operational_limits(base_state, default_config)
    assert limits.is_available is True
    assert limits.is_derated is False
    assert limits.max_charge_kw == 100.0
    assert limits.max_discharge_kw == 100.0
    assert limits.min_soc_pct == 10.0
    assert limits.max_soc_pct == 95.0
    assert limits.reserve_floor_pct == 25.0


def test_operational_limits_temperature_derating(
    scheduler: BatteryScheduler, base_state: AssetCurrentState, default_config: BatteryConfig
):
    # High temp (>55°C) -> 50% power derate
    base_state.temperature_celsius = 58.0
    limits_high = scheduler.calculate_operational_limits(base_state, default_config)
    assert limits_high.is_derated is True
    assert limits_high.derating_factor == 0.5
    assert limits_high.max_charge_kw == 50.0
    assert limits_high.max_discharge_kw == 50.0

    # Critical temp (>65°C) -> Shutdown (0 kW)
    base_state.temperature_celsius = 68.0
    limits_crit = scheduler.calculate_operational_limits(base_state, default_config)
    assert limits_crit.is_available is False
    assert limits_crit.max_charge_kw == 0.0
    assert limits_crit.max_discharge_kw == 0.0

    # Sub-zero temp (<0°C) -> Charge inhibited, discharge allowed
    base_state.temperature_celsius = -5.0
    limits_cold = scheduler.calculate_operational_limits(base_state, default_config)
    assert limits_cold.max_charge_kw == 0.0
    assert limits_cold.max_discharge_kw == 100.0


def test_operational_limits_degraded_health(
    scheduler: BatteryScheduler, base_state: AssetCurrentState, default_config: BatteryConfig
):
    base_state.health_percent = 65.0  # below 70.0% floor
    limits = scheduler.calculate_operational_limits(base_state, default_config)
    assert limits.is_derated is True
    assert limits.derating_factor == 0.75
    assert limits.max_charge_kw == 75.0
    assert limits.max_discharge_kw == 75.0


def test_operational_limits_offline_state(
    scheduler: BatteryScheduler, base_state: AssetCurrentState, default_config: BatteryConfig
):
    base_state.telemetry_quality = TelemetryQuality.INVALID
    limits = scheduler.calculate_operational_limits(base_state, default_config)
    assert limits.is_available is False
    assert limits.max_charge_kw == 0.0
    assert limits.max_discharge_kw == 0.0


def test_calculate_soc_delta(scheduler: BatteryScheduler):
    # Charge 100 kW for 15 min into 200 kWh battery with 0.92 RTE (one-way approx 0.959)
    # Energy = 100 * 0.25 * 0.959166 = 23.979 kWh -> delta = 23.979 / 200 * 100 = 11.99%
    delta_ch = scheduler.calculate_soc_delta(
        power_kw=100.0,
        action=BatteryAction.CHARGE,
        duration_minutes=15,
        capacity_kwh=200.0,
        round_trip_efficiency=0.92,
    )
    assert pytest.approx(delta_ch, abs=0.1) == 12.0

    # Discharge 100 kW for 15 min from 200 kWh battery with 0.92 RTE
    # Energy = (100 * 0.25) / 0.959166 = 26.06 kWh -> delta = -13.03%
    delta_dis = scheduler.calculate_soc_delta(
        power_kw=100.0,
        action=BatteryAction.DISCHARGE,
        duration_minutes=15,
        capacity_kwh=200.0,
        round_trip_efficiency=0.92,
    )
    assert pytest.approx(delta_dis, abs=0.1) == -13.03


def test_evaluate_dispatch_charge_clamping(
    scheduler: BatteryScheduler, base_state: AssetCurrentState, default_config: BatteryConfig
):
    base_state.soc_percent = 90.0  # Max is 95% -> only 5% room
    plan = scheduler.evaluate_dispatch(
        state=base_state,
        config=default_config,
        capacity_kwh=100.0,
        requested_action=BatteryAction.CHARGE,
        requested_power_kw=100.0,
        duration_minutes=15,
    )
    assert plan.action == BatteryAction.CHARGE
    assert plan.approved_power_kw < 25.0
    assert plan.projected_soc_pct <= 95.0
    assert plan.constraint_checks["soc_within_bounds"] is False


def test_evaluate_dispatch_discharge_reserve_floor_enforcement(
    scheduler: BatteryScheduler, base_state: AssetCurrentState, default_config: BatteryConfig
):
    # Economic dispatch: Cannot go below reserve floor (25%)
    base_state.soc_percent = 30.0
    plan_econ = scheduler.evaluate_dispatch(
        state=base_state,
        config=default_config,
        capacity_kwh=100.0,
        requested_action=BatteryAction.DISCHARGE,
        requested_power_kw=100.0,
        duration_minutes=15,
        is_emergency=False,
    )
    assert plan_econ.projected_soc_pct >= 25.0

    # When already at or below reserve floor, economic discharge is held
    base_state.soc_percent = 24.0
    plan_held = scheduler.evaluate_dispatch(
        state=base_state,
        config=default_config,
        capacity_kwh=100.0,
        requested_action=BatteryAction.DISCHARGE,
        requested_power_kw=50.0,
        duration_minutes=15,
        is_emergency=False,
    )
    assert plan_held.action == BatteryAction.HOLD
    assert plan_held.approved_power_kw == 0.0

    # Emergency dispatch: Can discharge down to min_soc (10%)
    plan_emerg = scheduler.evaluate_dispatch(
        state=base_state,
        config=default_config,
        capacity_kwh=100.0,
        requested_action=BatteryAction.DISCHARGE,
        requested_power_kw=50.0,
        duration_minutes=15,
        is_emergency=True,
    )
    assert plan_emerg.action == BatteryAction.DISCHARGE
    assert plan_emerg.approved_power_kw > 0.0
    assert plan_emerg.projected_soc_pct >= 10.0


def test_schedule_horizon_simulation(
    scheduler: BatteryScheduler, base_state: AssetCurrentState, default_config: BatteryConfig
):
    now = base_state.observed_at or datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)
    # 4 intervals: 2 surplus intervals (+60 kW, +40 kW), 2 deficit intervals (-50 kW, -70 kW)
    intervals = [
        ForecastInterval(
            interval_start=now + timedelta(minutes=0),
            interval_end=now + timedelta(minutes=15),
            solar_generation_kw=160.0,
            wind_generation_kw=0.0,
            total_generation_kw=160.0,
            campus_demand_kw=100.0,
            net_surplus_kw=60.0,
            confidence=0.9,
        ),
        ForecastInterval(
            interval_start=now + timedelta(minutes=15),
            interval_end=now + timedelta(minutes=30),
            solar_generation_kw=140.0,
            wind_generation_kw=0.0,
            total_generation_kw=140.0,
            campus_demand_kw=100.0,
            net_surplus_kw=40.0,
            confidence=0.9,
        ),
        ForecastInterval(
            interval_start=now + timedelta(minutes=30),
            interval_end=now + timedelta(minutes=45),
            solar_generation_kw=50.0,
            wind_generation_kw=0.0,
            total_generation_kw=50.0,
            campus_demand_kw=100.0,
            net_surplus_kw=-50.0,
            confidence=0.9,
        ),
        ForecastInterval(
            interval_start=now + timedelta(minutes=45),
            interval_end=now + timedelta(minutes=60),
            solar_generation_kw=30.0,
            wind_generation_kw=0.0,
            total_generation_kw=30.0,
            campus_demand_kw=100.0,
            net_surplus_kw=-70.0,
            confidence=0.9,
        ),
    ]

    base_state.soc_percent = 50.0
    horizon = scheduler.schedule_horizon(
        state=base_state,
        config=default_config,
        capacity_kwh=200.0,
        forecast_intervals=intervals,
    )

    assert len(horizon.plans) == 4
    assert horizon.plans[0].action == BatteryAction.CHARGE
    assert horizon.plans[1].action == BatteryAction.CHARGE
    assert horizon.plans[2].action == BatteryAction.DISCHARGE
    assert horizon.plans[3].action == BatteryAction.DISCHARGE
    assert horizon.total_charged_kwh > 0.0
    assert horizon.total_discharged_kwh > 0.0


def test_generate_decision_record(
    scheduler: BatteryScheduler, base_state: AssetCurrentState, default_config: BatteryConfig
):
    plan = scheduler.evaluate_dispatch(
        state=base_state,
        config=default_config,
        capacity_kwh=200.0,
        requested_action=BatteryAction.CHARGE,
        requested_power_kw=80.0,
        duration_minutes=15,
    )

    record = scheduler.generate_decision_record(
        plan=plan,
        cycle_id="cycle-1234",
        site_id=1,
    )

    assert record.cycle_id == "cycle-1234"
    assert record.site_id == 1
    assert record.decision_type == DecisionType.BATTERY
    assert record.action == "charge"
    assert record.setpoint_kw == 80.0
    assert record.allocated_kwh > 0.0
    assert "initial_soc_pct" in record.context_data
    assert "constraint_checks" in record.context_data
