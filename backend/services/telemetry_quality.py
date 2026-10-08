import math
from datetime import datetime, timezone
from typing import Callable, Dict, Optional, Tuple

from backend.config import Settings
from backend.models.base import utc_now
from backend.models.digital_twin import AssetType
from backend.models.telemetry import (
    AssetTelemetrySnapshot,
    CanonicalMeasurement,
    EnergySnapshot,
    TelemetryQuality,
)

# Physical plausible bounds for engineering validations
BOUNDS: Dict[str, Tuple[float, float]] = {
    "soc_percent": (0.0, 100.0),
    "health_percent": (0.0, 100.0),
    "soc": (0.0, 100.0),
    "soh": (0.0, 100.0),
    "battery_soc": (0.0, 100.0),
    "battery_health": (0.0, 100.0),
    "temperature_celsius": (-60.0, 150.0),
    "temperature": (-60.0, 150.0),
    "battery_temperature": (-60.0, 150.0),
    "wind_speed_ms": (0.0, 120.0),
    "wind_speed": (0.0, 120.0),
    "wind_direction_deg": (0.0, 360.0),
    "frequency_hz": (35.0, 85.0),
    "frequency": (35.0, 85.0),
    "voltage_v": (0.0, 1_000_000.0),
    "voltage": (0.0, 1_000_000.0),
    "current_a": (0.0, 100_000.0),
    "power_factor": (-1.0, 1.0),
}


# Unit conversion lookup tables and converters
_POWER_FACTORS: Dict[str, float] = {
    "w": 0.001,
    "watt": 0.001,
    "watts": 0.001,
    "mw": 1000.0,
    "megawatt": 1000.0,
    "megawatts": 1000.0,
    "kw": 1.0,
    "kilowatt": 1.0,
    "kilowatts": 1.0,
}

_ENERGY_FACTORS: Dict[str, float] = {
    "wh": 0.001,
    "watthour": 0.001,
    "watthours": 0.001,
    "mwh": 1000.0,
    "megawatthour": 1000.0,
    "megawatthours": 1000.0,
    "kwh": 1.0,
    "kilowatthour": 1.0,
    "kilowatthours": 1.0,
}

_SPEED_FACTORS: Dict[str, float] = {
    "km/h": 1.0 / 3.6,
    "kph": 1.0 / 3.6,
    "kmh": 1.0 / 3.6,
    "mph": 0.44704,
    "miles/h": 0.44704,
    "knots": 0.514444,
    "knot": 0.514444,
    "kts": 0.514444,
    "m/s": 1.0,
    "mps": 1.0,
    "meter/second": 1.0,
    "meters/second": 1.0,
}

_ELECTRICAL_FACTORS: Dict[str, Tuple[float, str]] = {
    "mv": (0.001, "V"),
    "millivolt": (0.001, "V"),
    "millivolts": (0.001, "V"),
    "kv": (1000.0, "V"),
    "kilovolt": (1000.0, "V"),
    "kilovolts": (1000.0, "V"),
    "v": (1.0, "V"),
    "volt": (1.0, "V"),
    "volts": (1.0, "V"),
    "ma": (0.001, "A"),
    "milliamp": (0.001, "A"),
    "milliamps": (0.001, "A"),
    "milliampere": (0.001, "A"),
    "ka": (1000.0, "A"),
    "kiloamp": (1000.0, "A"),
    "kiloamps": (1000.0, "A"),
    "kiloampere": (1000.0, "A"),
    "a": (1.0, "A"),
    "amp": (1.0, "A"),
    "amps": (1.0, "A"),
    "ampere": (1.0, "A"),
    "khz": (1000.0, "Hz"),
    "kilohertz": (1000.0, "Hz"),
    "hz": (1.0, "Hz"),
    "hertz": (1.0, "Hz"),
}

_TEMP_CONVERTERS: Dict[str, Callable[[float], float]] = {
    "f": lambda val: (val - 32.0) * 5.0 / 9.0,
    "°f": lambda val: (val - 32.0) * 5.0 / 9.0,
    "degf": lambda val: (val - 32.0) * 5.0 / 9.0,
    "fahrenheit": lambda val: (val - 32.0) * 5.0 / 9.0,
    "k": lambda val: val - 273.15,
    "degk": lambda val: val - 273.15,
    "kelvin": lambda val: val - 273.15,
    "c": lambda val: val,
    "°c": lambda val: val,
    "degc": lambda val: val,
    "celsius": lambda val: val,
}


def _convert_temperature(raw_value: float, unit: str) -> Optional[Tuple[float, str]]:
    converter = _TEMP_CONVERTERS.get(unit)
    if converter is not None:
        return converter(raw_value), "C"
    return None


def _convert_percentage(
    metric: str, raw_value: float, unit: str
) -> Optional[Tuple[float, str]]:
    if any(k in metric for k in ("soc", "health", "soh")):
        if unit in ("ratio", "fraction", "0-1") or (
            0.0 <= raw_value <= 1.0 and unit in ("p.u.", "pu")
        ):
            return raw_value * 100.0, "%"
        if unit in ("%", "pct", "percent"):
            return raw_value, "%"
    return None


def normalize_unit(
    metric_name: str,
    raw_value: Optional[float],
    raw_unit: str,
) -> Tuple[Optional[float], str]:
    """
    Normalizes measured engineering values to SURYA canonical units:
    - Power: kW
    - Energy: kWh
    - Battery SoC / Health: %
    - Temperature: C
    - Wind Speed: m/s
    - Voltage: V
    - Current: A
    - Frequency: Hz
    """
    if raw_value is None:
        return None, raw_unit

    unit = raw_unit.strip().lower()
    metric = metric_name.strip().lower()

    if unit in _POWER_FACTORS:
        return raw_value * _POWER_FACTORS[unit], "kW"

    if unit in _ENERGY_FACTORS:
        return raw_value * _ENERGY_FACTORS[unit], "kWh"

    temp_res = _convert_temperature(raw_value, unit)
    if temp_res is not None:
        return temp_res

    if unit in _SPEED_FACTORS:
        return raw_value * _SPEED_FACTORS[unit], "m/s"

    if unit in _ELECTRICAL_FACTORS:
        factor, target_unit = _ELECTRICAL_FACTORS[unit]
        return raw_value * factor, target_unit

    pct_res = _convert_percentage(metric, raw_value, unit)
    if pct_res is not None:
        return pct_res

    return raw_value, raw_unit


def is_physically_plausible(
    metric_name: str,
    value: Optional[float],
    asset_type: Optional[AssetType] = None,
) -> bool:
    """
    Checks if a normalized value falls within known physical domain limits.
    """
    if value is None or math.isnan(value) or math.isinf(value):
        return False

    metric_lower = metric_name.strip().lower()

    # Asset-specific power rules
    if metric_lower in ("active_power_kw", "power_kw", "generation_kw"):
        if asset_type in (
            AssetType.SOLAR,
            AssetType.WIND,
            AssetType.LOAD,
            AssetType.BUILDING,
        ):
            # Generation and loads should not be negative beyond small tare tolerance
            if value < -0.05:
                return False

    # Check known domain bounds
    for bound_key, (min_val, max_val) in BOUNDS.items():
        if bound_key in metric_lower:
            if value < min_val or value > max_val:
                return False

    return True


def evaluate_measurement_quality(
    measurement: CanonicalMeasurement,
    stale_after_seconds: float = 30.0,
    failure_after_seconds: float = 60.0,
    now: Optional[datetime] = None,
    asset_type: Optional[AssetType] = None,
) -> TelemetryQuality:
    """
    Evaluates measurement quality according to SURYA spec Section 8.3:
    - Missing: value is None or older than failure_after_seconds
    - Invalid: NaN/Inf or out of physical plausibility bounds
    - Stale: older than stale_after_seconds
    - Suspect: future timestamp or unexpected boundary condition
    - Good: fresh, valid, within plausible physical limits
    """
    if measurement.value is None:
        return TelemetryQuality.MISSING

    if not is_physically_plausible(
        measurement.metric_name, measurement.value, asset_type
    ):
        return TelemetryQuality.INVALID

    now_dt = now or utc_now()
    if now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=timezone.utc)

    obs_dt = measurement.observed_at
    if obs_dt.tzinfo is None:
        obs_dt = obs_dt.replace(tzinfo=timezone.utc)

    age_seconds = (now_dt - obs_dt).total_seconds()

    if age_seconds < -30.0:
        return TelemetryQuality.SUSPECT

    if age_seconds >= failure_after_seconds:
        return TelemetryQuality.MISSING

    if age_seconds >= stale_after_seconds:
        return TelemetryQuality.STALE

    if measurement.quality in (TelemetryQuality.SUSPECT, TelemetryQuality.INVALID):
        return measurement.quality

    return TelemetryQuality.GOOD


def _compute_asset_status(
    qualities: list[TelemetryQuality],
) -> Tuple[str, TelemetryQuality]:
    """Derives asset operational status from individual measurement qualities."""
    if not qualities or all(q == TelemetryQuality.MISSING for q in qualities):
        return "offline", TelemetryQuality.MISSING

    if all(q in (TelemetryQuality.STALE, TelemetryQuality.MISSING) for q in qualities):
        return "stale", TelemetryQuality.STALE

    degraded_qualities = (
        TelemetryQuality.INVALID,
        TelemetryQuality.SUSPECT,
        TelemetryQuality.STALE,
        TelemetryQuality.MISSING,
    )
    if any(q in degraded_qualities for q in qualities):
        return "degraded", TelemetryQuality.SUSPECT

    return "online", TelemetryQuality.GOOD


def assess_asset_snapshot(
    snapshot: AssetTelemetrySnapshot,
    stale_after_seconds: float = 30.0,
    failure_after_seconds: float = 60.0,
    now: Optional[datetime] = None,
) -> AssetTelemetrySnapshot:
    """
    Evaluates all measurements within an AssetTelemetrySnapshot and updates asset operational status
    and quality classification.
    """
    now_dt = now or utc_now()
    if now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=timezone.utc)

    if not snapshot.measurements:
        return snapshot.model_copy(
            update={
                "status": "offline",
                "quality": TelemetryQuality.MISSING,
                "received_at": now_dt,
            }
        )

    updated_measurements: Dict[str, CanonicalMeasurement] = {}
    latest_obs: Optional[datetime] = snapshot.observed_at

    for name, m in snapshot.measurements.items():
        norm_val, norm_unit = normalize_unit(m.metric_name, m.value, m.unit)
        evaluated_q = evaluate_measurement_quality(
            m.model_copy(update={"value": norm_val, "unit": norm_unit}),
            stale_after_seconds=stale_after_seconds,
            failure_after_seconds=failure_after_seconds,
            now=now_dt,
            asset_type=snapshot.asset_type,
        )

        updated_measurements[name] = m.model_copy(
            update={
                "value": norm_val,
                "unit": norm_unit,
                "quality": evaluated_q,
                "received_at": now_dt,
            }
        )

        if latest_obs is None or (m.observed_at and m.observed_at > latest_obs):
            latest_obs = m.observed_at

    qualities = [m.quality for m in updated_measurements.values()]
    asset_status, asset_quality = _compute_asset_status(qualities)

    # Check overall asset observation freshness
    if latest_obs:
        obs_utc = (
            latest_obs if latest_obs.tzinfo else latest_obs.replace(tzinfo=timezone.utc)
        )
        asset_age = (now_dt - obs_utc).total_seconds()
        if asset_age >= failure_after_seconds:
            asset_status = "offline"
            asset_quality = TelemetryQuality.MISSING
        elif asset_age >= stale_after_seconds and asset_status != "offline":
            asset_status = "stale"
            asset_quality = TelemetryQuality.STALE

    return snapshot.model_copy(
        update={
            "observed_at": latest_obs,
            "received_at": now_dt,
            "status": asset_status,
            "quality": asset_quality,
            "measurements": updated_measurements,
        }
    )


def assess_energy_snapshot(
    snapshot: EnergySnapshot,
    settings: Optional[Settings] = None,
    stale_after_seconds: Optional[float] = None,
    failure_after_seconds: Optional[float] = None,
    now: Optional[datetime] = None,
) -> EnergySnapshot:
    """
    Evaluates campus-wide EnergySnapshot across all assets.
    """
    stale_sec = (
        stale_after_seconds
        if stale_after_seconds is not None
        else (settings.TELEMETRY_STALE_AFTER_SECONDS if settings else 30.0)
    )
    fail_sec = (
        failure_after_seconds
        if failure_after_seconds is not None
        else (settings.TELEMETRY_FAILURE_AFTER_SECONDS if settings else 60.0)
    )
    now_dt = now or utc_now()

    assessed_assets = {
        asset_id: assess_asset_snapshot(
            asset_snap,
            stale_after_seconds=stale_sec,
            failure_after_seconds=fail_sec,
            now=now_dt,
        )
        for asset_id, asset_snap in snapshot.assets.items()
    }

    return snapshot.model_copy(
        update={
            "captured_at": now_dt,
            "assets": assessed_assets,
        }
    )
