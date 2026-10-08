from datetime import datetime, timedelta, timezone

import pytest

from backend.models.telemetry import TelemetryPoint, TelemetryQuality
from backend.services.digital_twin_store import CampusAggregate
from backend.services.forecast_engine import (
    CampusForecast,
    ForecastEngine,
    ForecastInterval,
)


@pytest.fixture
def forecast_engine() -> ForecastEngine:
    return ForecastEngine()


@pytest.fixture
def base_time() -> datetime:
    return datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)


def test_solar_diurnal_factor(forecast_engine: ForecastEngine):
    # Night time (before 06:00 or after 18:00)
    dt_midnight = datetime(2026, 6, 21, 0, 0, 0, tzinfo=timezone.utc)
    dt_early = datetime(2026, 6, 21, 5, 59, 0, tzinfo=timezone.utc)
    dt_late = datetime(2026, 6, 21, 18, 1, 0, tzinfo=timezone.utc)
    dt_night = datetime(2026, 6, 21, 23, 0, 0, tzinfo=timezone.utc)

    assert forecast_engine._get_solar_diurnal_factor(dt_midnight) == 0.0
    assert forecast_engine._get_solar_diurnal_factor(dt_early) == 0.0
    assert forecast_engine._get_solar_diurnal_factor(dt_late) == 0.0
    assert forecast_engine._get_solar_diurnal_factor(dt_night) == 0.0

    # Solar noon (12:00) should be peak (1.0)
    dt_noon = datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)
    assert pytest.approx(forecast_engine._get_solar_diurnal_factor(dt_noon), abs=0.01) == 1.0

    # Morning (09:00) and afternoon (15:00)
    dt_9am = datetime(2026, 6, 21, 9, 0, 0, tzinfo=timezone.utc)
    dt_3pm = datetime(2026, 6, 21, 15, 0, 0, tzinfo=timezone.utc)
    # sin(pi/4) approx 0.707
    assert pytest.approx(forecast_engine._get_solar_diurnal_factor(dt_9am), abs=0.01) == 0.707
    assert pytest.approx(forecast_engine._get_solar_diurnal_factor(dt_3pm), abs=0.01) == 0.707


def test_predict_series_point_empty_history(forecast_engine: ForecastEngine, base_time: datetime):
    target_dt = base_time + timedelta(hours=1)

    # Solar forecast at 13:00 (diurnal factor active)
    val, conf, is_deg = forecast_engine._predict_series_point(
        history=[],
        current_val=100.0,
        target_dt=target_dt,
        now_dt=base_time,
        is_solar=True,
    )
    # At 13:00: (13-6)/12 * pi = 7/12 * pi => sin(7pi/12) approx 0.9659
    assert val > 90.0
    assert is_deg is True
    assert conf <= 0.5

    # Non-solar forecast
    val_wind, conf_wind, is_deg_wind = forecast_engine._predict_series_point(
        history=[],
        current_val=50.0,
        target_dt=target_dt,
        now_dt=base_time,
        is_solar=False,
    )
    assert val_wind == 50.0
    assert is_deg_wind is True


def test_predict_series_point_with_history(forecast_engine: ForecastEngine, base_time: datetime):
    # 5 historical data points within the last 2 hours
    history = [
        TelemetryPoint(
            asset_id=1,
            metric_name="power_kw",
            value=80.0 + (i * 2.0),
            observed_at=base_time - timedelta(minutes=(5 - i) * 15),
            received_at=base_time,
            quality=TelemetryQuality.GOOD,
        )
        for i in range(5)
    ]

    target_dt = base_time + timedelta(minutes=15)

    val, conf, is_deg = forecast_engine._predict_series_point(
        history=history,
        current_val=88.0,
        target_dt=target_dt,
        now_dt=base_time,
        is_solar=False,
    )

    assert 80.0 <= val <= 90.0
    assert conf >= 0.8
    assert is_deg is False


def test_predict_series_point_degraded_due_to_few_points(
    forecast_engine: ForecastEngine, base_time: datetime
):
    # Only 2 points (< 4 points triggers degradation)
    history = [
        TelemetryPoint(
            asset_id=1,
            metric_name="power_kw",
            value=50.0,
            observed_at=base_time - timedelta(minutes=15),
            received_at=base_time,
            quality=TelemetryQuality.GOOD,
        ),
        TelemetryPoint(
            asset_id=1,
            metric_name="power_kw",
            value=50.0,
            observed_at=base_time - timedelta(minutes=30),
            received_at=base_time,
            quality=TelemetryQuality.GOOD,
        ),
    ]

    target_dt = base_time + timedelta(minutes=15)
    val, conf, is_deg = forecast_engine._predict_series_point(
        history=history,
        current_val=50.0,
        target_dt=target_dt,
        now_dt=base_time,
        is_solar=False,
    )
    assert is_deg is True


def test_generate_campus_forecast_full(forecast_engine: ForecastEngine, base_time: datetime):
    aggregate = CampusAggregate(
        site_id=1,
        captured_at=base_time,
        total_solar_kw=120.0,
        total_wind_kw=30.0,
        total_generation_kw=150.0,
        total_building_demand_kw=100.0,
        net_grid_flow_kw=-50.0,
        average_battery_soc_percent=80.0,
        online_assets_count=5,
        stale_assets_count=0,
        degraded_assets_count=0,
        offline_assets_count=0,
    )

    # 6 points for solar, wind, demand to ensure non-degraded
    solar_history = [
        TelemetryPoint(
            asset_id=1,
            metric_name="solar_power_kw",
            value=110.0 + i,
            observed_at=base_time - timedelta(minutes=(6 - i) * 10),
            received_at=base_time,
            quality=TelemetryQuality.GOOD,
        )
        for i in range(6)
    ]
    wind_history = [
        TelemetryPoint(
            asset_id=2,
            metric_name="wind_power_kw",
            value=30.0,
            observed_at=base_time - timedelta(minutes=(6 - i) * 10),
            received_at=base_time,
            quality=TelemetryQuality.GOOD,
        )
        for i in range(6)
    ]
    demand_history = [
        TelemetryPoint(
            asset_id=3,
            metric_name="demand_power_kw",
            value=100.0,
            observed_at=base_time - timedelta(minutes=(6 - i) * 10),
            received_at=base_time,
            quality=TelemetryQuality.GOOD,
        )
        for i in range(6)
    ]

    historical_data = {
        "solar": solar_history,
        "wind": wind_history,
        "demand": demand_history,
    }

    forecast: CampusForecast = forecast_engine.generate_campus_forecast(
        site_id=1,
        current_aggregate=aggregate,
        historical_points=historical_data,
        horizon_hours=2,
        interval_minutes=15,
        now=base_time,
    )

    # 2 hours * (60 / 15) = 8 intervals
    assert len(forecast.intervals) == 8
    assert forecast.site_id == 1
    assert forecast.horizon_hours == 2.0
    assert forecast.interval_minutes == 15
    assert forecast.mean_confidence > 0.7
    assert forecast.is_degraded is False

    for interval in forecast.intervals:
        assert isinstance(interval, ForecastInterval)
        assert interval.solar_generation_kw >= 0.0
        assert interval.wind_generation_kw >= 0.0
        assert (
            pytest.approx(interval.total_generation_kw, abs=0.01)
            == interval.solar_generation_kw + interval.wind_generation_kw
        )
        assert (
            pytest.approx(interval.net_surplus_kw, abs=0.01)
            == interval.total_generation_kw - interval.campus_demand_kw
        )
