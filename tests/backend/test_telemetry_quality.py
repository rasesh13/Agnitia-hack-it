from datetime import datetime, timedelta, timezone

import pytest

from backend.config import Settings
from backend.models.digital_twin import AssetType
from backend.models.telemetry import (
    AssetTelemetrySnapshot,
    CanonicalMeasurement,
    EnergySnapshot,
    TelemetryQuality,
)
from backend.services.telemetry_quality import (
    assess_asset_snapshot,
    assess_energy_snapshot,
    evaluate_measurement_quality,
    is_physically_plausible,
    normalize_unit,
)


def test_unit_normalization_power():
    val, unit = normalize_unit("active_power_kw", 5000.0, "W")
    assert val == pytest.approx(5.0)
    assert unit == "kW"

    val, unit = normalize_unit("active_power_kw", 2.5, "MW")
    assert val == pytest.approx(2500.0)
    assert unit == "kW"

    val, unit = normalize_unit("active_power_kw", 15.0, "kW")
    assert val == pytest.approx(15.0)
    assert unit == "kW"


def test_unit_normalization_energy():
    val, unit = normalize_unit("energy_kwh", 1500.0, "Wh")
    assert val == pytest.approx(1.5)
    assert unit == "kWh"

    val, unit = normalize_unit("energy_kwh", 3.0, "MWh")
    assert val == pytest.approx(3000.0)
    assert unit == "kWh"


def test_unit_normalization_temperature():
    # 32 F = 0 C, 212 F = 100 C
    val, unit = normalize_unit("temperature_celsius", 32.0, "F")
    assert val == pytest.approx(0.0)
    assert unit == "C"

    val, unit = normalize_unit("temperature_celsius", 212.0, "degF")
    assert val == pytest.approx(100.0)
    assert unit == "C"

    # 300 K = 26.85 C
    val, unit = normalize_unit("temperature_celsius", 300.0, "K")
    assert val == pytest.approx(26.85)
    assert unit == "C"


def test_unit_normalization_wind_speed():
    # 36 km/h = 10 m/s
    val, unit = normalize_unit("wind_speed_ms", 36.0, "km/h")
    assert val == pytest.approx(10.0)
    assert unit == "m/s"

    # ~100 mph = 44.704 m/s
    val, unit = normalize_unit("wind_speed_ms", 100.0, "mph")
    assert val == pytest.approx(44.704)
    assert unit == "m/s"


def test_unit_normalization_electrical():
    val, unit = normalize_unit("voltage_v", 12000.0, "mV")
    assert val == pytest.approx(12.0)
    assert unit == "V"

    val, unit = normalize_unit("current_a", 2500.0, "mA")
    assert val == pytest.approx(2.5)
    assert unit == "A"

    val, unit = normalize_unit("frequency_hz", 0.05, "kHz")
    assert val == pytest.approx(50.0)
    assert unit == "Hz"


def test_unit_normalization_soc_health():
    # Fraction -> %
    val, unit = normalize_unit("battery_soc", 0.85, "fraction")
    assert val == pytest.approx(85.0)
    assert unit == "%"

    val, unit = normalize_unit("health_percent", 95.0, "%")
    assert val == pytest.approx(95.0)
    assert unit == "%"


def test_is_physically_plausible():
    assert is_physically_plausible("battery_soc", 50.0)
    assert not is_physically_plausible("battery_soc", 105.0)
    assert not is_physically_plausible("battery_soc", -5.0)

    assert is_physically_plausible("wind_speed_ms", 15.0)
    assert not is_physically_plausible("wind_speed_ms", -1.0)
    assert not is_physically_plausible("wind_speed_ms", 200.0)

    assert is_physically_plausible("frequency_hz", 50.1)
    assert not is_physically_plausible("frequency_hz", 20.0)

    # Solar cannot generate negative power
    assert is_physically_plausible("active_power_kw", 10.0, AssetType.SOLAR)
    assert not is_physically_plausible("active_power_kw", -5.0, AssetType.SOLAR)

    # NaN / Inf checks
    assert not is_physically_plausible("temperature_celsius", float("nan"))
    assert not is_physically_plausible("temperature_celsius", float("inf"))


def test_evaluate_measurement_quality_staleness():
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)

    # Fresh reading (5s old)
    fresh_m = CanonicalMeasurement(
        metric_name="active_power_kw",
        value=10.5,
        unit="kW",
        observed_at=now - timedelta(seconds=5),
        quality=TelemetryQuality.GOOD,
    )
    assert (
        evaluate_measurement_quality(
            fresh_m, stale_after_seconds=30, failure_after_seconds=60, now=now
        )
        == TelemetryQuality.GOOD
    )

    # Stale reading (45s old)
    stale_m = CanonicalMeasurement(
        metric_name="active_power_kw",
        value=10.5,
        unit="kW",
        observed_at=now - timedelta(seconds=45),
        quality=TelemetryQuality.GOOD,
    )
    assert (
        evaluate_measurement_quality(
            stale_m, stale_after_seconds=30, failure_after_seconds=60, now=now
        )
        == TelemetryQuality.STALE
    )

    # Missing / Expired reading (75s old)
    missing_m = CanonicalMeasurement(
        metric_name="active_power_kw",
        value=10.5,
        unit="kW",
        observed_at=now - timedelta(seconds=75),
        quality=TelemetryQuality.GOOD,
    )
    assert (
        evaluate_measurement_quality(
            missing_m, stale_after_seconds=30, failure_after_seconds=60, now=now
        )
        == TelemetryQuality.MISSING
    )

    # Future reading (60s in future)
    future_m = CanonicalMeasurement(
        metric_name="active_power_kw",
        value=10.5,
        unit="kW",
        observed_at=now + timedelta(seconds=60),
        quality=TelemetryQuality.GOOD,
    )
    assert (
        evaluate_measurement_quality(
            future_m, stale_after_seconds=30, failure_after_seconds=60, now=now
        )
        == TelemetryQuality.SUSPECT
    )


def test_evaluate_measurement_quality_bounds():
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)

    # Invalid SoC (>100%)
    invalid_soc = CanonicalMeasurement(
        metric_name="battery_soc",
        value=150.0,
        unit="%",
        observed_at=now - timedelta(seconds=2),
    )
    assert evaluate_measurement_quality(invalid_soc, now=now) == TelemetryQuality.INVALID

    # None value
    none_val = CanonicalMeasurement(
        metric_name="active_power_kw",
        value=None,
        unit="kW",
        observed_at=now - timedelta(seconds=2),
    )
    assert evaluate_measurement_quality(none_val, now=now) == TelemetryQuality.MISSING


def test_assess_asset_snapshot():
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)

    # Online asset with good measurements in non-canonical units (W converted to kW)
    asset_snap = AssetTelemetrySnapshot(
        asset_id="solar-01",
        asset_type=AssetType.SOLAR,
        measurements={
            "active_power_kw": CanonicalMeasurement(
                metric_name="active_power_kw",
                value=50000.0,
                unit="W",
                observed_at=now - timedelta(seconds=5),
            )
        },
    )

    assessed = assess_asset_snapshot(
        asset_snap, stale_after_seconds=30, failure_after_seconds=60, now=now
    )
    assert assessed.status == "online"
    assert assessed.quality == TelemetryQuality.GOOD
    assert assessed.measurements["active_power_kw"].value == pytest.approx(50.0)
    assert assessed.measurements["active_power_kw"].unit == "kW"

    # Degraded asset with one good and one invalid measurement
    degraded_snap = AssetTelemetrySnapshot(
        asset_id="batt-01",
        asset_type=AssetType.BATTERY,
        measurements={
            "battery_soc": CanonicalMeasurement(
                metric_name="battery_soc",
                value=200.0,  # Invalid
                unit="%",
                observed_at=now - timedelta(seconds=5),
            ),
            "temperature_celsius": CanonicalMeasurement(
                metric_name="temperature_celsius",
                value=25.0,  # Good
                unit="C",
                observed_at=now - timedelta(seconds=5),
            ),
        },
    )

    assessed_deg = assess_asset_snapshot(
        degraded_snap, stale_after_seconds=30, failure_after_seconds=60, now=now
    )
    assert assessed_deg.status == "degraded"
    assert assessed_deg.quality == TelemetryQuality.SUSPECT


def test_assess_energy_snapshot():
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)
    settings = Settings(
        TELEMETRY_STALE_AFTER_SECONDS=30,
        TELEMETRY_FAILURE_AFTER_SECONDS=60,
    )

    energy_snap = EnergySnapshot(
        site_id=1,
        snapshot_id="snap-test-01",
        adapter_id="rest_primary",
        assets={
            "solar-01": AssetTelemetrySnapshot(
                asset_id="solar-01",
                asset_type=AssetType.SOLAR,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=12.0,
                        unit="kW",
                        observed_at=now - timedelta(seconds=10),
                    )
                },
            ),
            "wind-01": AssetTelemetrySnapshot(
                asset_id="wind-01",
                asset_type=AssetType.WIND,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=8.0,
                        unit="kW",
                        observed_at=now - timedelta(seconds=45),  # Stale
                    )
                },
            ),
        },
    )

    evaluated_energy = assess_energy_snapshot(energy_snap, settings=settings, now=now)
    assert evaluated_energy.assets["solar-01"].status == "online"
    assert evaluated_energy.assets["wind-01"].status == "stale"
