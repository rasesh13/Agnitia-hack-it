import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field

from backend.models.base import utc_now
from backend.models.telemetry import TelemetryPoint, TelemetryQuality
from backend.services.digital_twin_store import CampusAggregate


class ForecastInterval(BaseModel):
    """
    Discrete forecast interval for renewable generation and campus load.
    Conforms to SURYA spec Section 10.
    """

    model_config = ConfigDict(extra="forbid")

    interval_start: datetime = Field(..., description="Start timestamp of interval")
    interval_end: datetime = Field(..., description="End timestamp of interval")
    solar_generation_kw: float = Field(
        0.0, ge=0.0, description="Predicted solar generation in kW"
    )
    wind_generation_kw: float = Field(
        0.0, ge=0.0, description="Predicted wind generation in kW"
    )
    total_generation_kw: float = Field(
        0.0, ge=0.0, description="Predicted total generation in kW"
    )
    campus_demand_kw: float = Field(
        0.0, ge=0.0, description="Predicted campus electrical load in kW"
    )
    net_surplus_kw: float = Field(
        0.0, description="Net balance: positive=surplus, negative=deficit"
    )
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence score")
    is_degraded: bool = Field(
        False, description="True if forecast relies on degraded/sparse data"
    )
    source_method: str = Field(
        "history_weighted_moving_average", description="Algorithm source method"
    )


class CampusForecast(BaseModel):
    """
    Campus-wide generation and demand forecast over a multi-hour horizon.
    """

    model_config = ConfigDict(extra="forbid")

    site_id: int = Field(..., description="Site identifier")
    generated_at: datetime = Field(
        default_factory=utc_now, description="Forecast creation timestamp"
    )
    horizon_hours: float = Field(4.0, gt=0, description="Forecast lookahead in hours")
    interval_minutes: int = Field(
        15, gt=0, description="Duration of each forecast interval in minutes"
    )
    intervals: List[ForecastInterval] = Field(
        default_factory=list, description="Chronological intervals"
    )
    mean_confidence: float = Field(
        1.0, ge=0.0, le=1.0, description="Average confidence score across horizon"
    )
    is_degraded: bool = Field(
        False, description="True if any interval in horizon is degraded"
    )
    asset_forecasts: Optional[Dict[str, List[Dict[str, Any]]]] = Field(
        None, description="Optional per-asset breakdown"
    )


class ForecastEngine:
    """
    Renewable generation and demand forecasting engine.
    Computes time-decayed, diurnal-adjusted projections from measured historical intervals.
    """

    def _get_solar_diurnal_factor(self, dt: datetime) -> float:
        """
        Calculates diurnal solar radiation factor (0.0 at night, up to 1.0 at solar noon).
        Assumes solar window between 06:00 and 18:00 local site time.
        """
        hour = dt.hour + (dt.minute / 60.0)
        if hour < 6.0 or hour > 18.0:
            return 0.0
        angle = (hour - 6.0) / 12.0 * math.pi
        return math.sin(angle)

    def _predict_series_point(
        self,
        history: List[TelemetryPoint],
        current_val: float,
        target_dt: datetime,
        now_dt: datetime,
        is_solar: bool = False,
    ) -> Tuple[float, float, bool]:
        """
        Predicts value and confidence for a target timestamp using historical points.
        Returns: (predicted_val, confidence, is_degraded)
        """
        hours_ahead = (target_dt - now_dt).total_seconds() / 3600.0
        time_decay = max(0.4, 1.0 - (hours_ahead * 0.05))

        valid_qualities = (TelemetryQuality.GOOD, TelemetryQuality.SUSPECT)
        valid_points = [
            p for p in history
            if p.value is not None and p.quality in valid_qualities
        ]

        if not valid_points:
            if is_solar:
                factor = self._get_solar_diurnal_factor(target_dt)
                pred_val = current_val * factor
            else:
                pred_val = current_val
            return round(max(0.0, pred_val), 2), round(time_decay * 0.5, 2), True

        weights = []
        weighted_sum = 0.0
        for p in valid_points:
            obs_dt = (
                p.observed_at
                if p.observed_at.tzinfo
                else p.observed_at.replace(tzinfo=timezone.utc)
            )
            age_hours = max(0.0, (now_dt - obs_dt).total_seconds() / 3600.0)
            weight = math.exp(-age_hours / 6.0)
            weights.append(weight)
            weighted_sum += (p.value or 0.0) * weight

        total_weight = sum(weights)
        base_pred = (weighted_sum / total_weight) if total_weight > 0 else current_val

        blend_factor = max(0.0, min(1.0, 1.0 - (hours_ahead / 4.0)))
        pred_val = (current_val * blend_factor) + (base_pred * (1.0 - blend_factor))

        if is_solar:
            solar_factor = self._get_solar_diurnal_factor(target_dt)
            pred_val = pred_val * solar_factor

        good_count = sum(1 for p in valid_points if p.quality == TelemetryQuality.GOOD)
        quality_score = good_count / len(valid_points) if valid_points else 0.5
        final_confidence = min(1.0, max(0.1, time_decay * quality_score))
        is_degraded = final_confidence < 0.65 or len(valid_points) < 4

        return round(max(0.0, pred_val), 2), round(final_confidence, 2), is_degraded

    def generate_campus_forecast(
        self,
        site_id: int,
        current_aggregate: CampusAggregate,
        historical_points: Optional[Dict[str, List[TelemetryPoint]]] = None,
        horizon_hours: int = 4,
        interval_minutes: int = 15,
        now: Optional[datetime] = None,
    ) -> CampusForecast:
        """
        Generates interval forecast for solar generation, wind generation, and campus load.
        """
        now_dt = now or utc_now()
        if now_dt.tzinfo is None:
            now_dt = now_dt.replace(tzinfo=timezone.utc)

        history = historical_points or {}
        solar_history = history.get("solar", [])
        wind_history = history.get("wind", [])
        demand_history = history.get("demand", [])

        num_intervals = int((horizon_hours * 60) / interval_minutes)
        intervals: List[ForecastInterval] = []
        confidences: List[float] = []
        has_degraded = False

        ml_forecast = None
        try:
            from backend.services.agnitia_ml_forecaster import ml_forecaster
            if ml_forecaster.is_ready():
                ml_forecast = ml_forecaster.forecast_48h(region_id="central_india_mp_indore", start_dt=now_dt)
        except Exception:
            ml_forecast = None

        for i in range(1, num_intervals + 1):
            t_start = now_dt + timedelta(minutes=(i - 1) * interval_minutes)
            t_end = now_dt + timedelta(minutes=i * interval_minutes)
            t_mid = t_start + timedelta(minutes=interval_minutes / 2.0)

            solar_kw, s_conf, s_deg = self._predict_series_point(
                history=solar_history,
                current_val=current_aggregate.total_solar_kw,
                target_dt=t_mid,
                now_dt=now_dt,
                is_solar=True,
            )

            wind_kw, w_conf, w_deg = self._predict_series_point(
                history=wind_history,
                current_val=current_aggregate.total_wind_kw,
                target_dt=t_mid,
                now_dt=now_dt,
                is_solar=False,
            )

            demand_kw, d_conf, d_deg = self._predict_series_point(
                history=demand_history,
                current_val=current_aggregate.total_building_demand_kw,
                target_dt=t_mid,
                now_dt=now_dt,
                is_solar=False,
            )

            source_method = "history_weighted_moving_average"
            if ml_forecast and "solar" in ml_forecast.series:
                source_method = "lightgbm_quantile_ml_hybrid"
                hr_idx = min(int((t_mid - now_dt).total_seconds() / 3600), len(ml_forecast.series["solar"]) - 1)
                ml_solar = ml_forecast.series["solar"][hr_idx].p50_prediction
                ml_wind = ml_forecast.series["wind"][hr_idx].p50_prediction
                ml_demand = ml_forecast.series["demand"][hr_idx].p50_prediction

                if solar_history:
                    solar_kw = round(0.3 * solar_kw + 0.7 * ml_solar, 2)
                else:
                    solar_kw = round(ml_solar, 2)
                    s_conf = 0.95
                    s_deg = False

                if wind_history:
                    wind_kw = round(0.3 * wind_kw + 0.7 * ml_wind, 2)
                else:
                    wind_kw = round(ml_wind, 2)
                    w_conf = 0.92
                    w_deg = False

                if demand_history:
                    demand_kw = round(0.3 * demand_kw + 0.7 * ml_demand, 2)
                else:
                    demand_kw = round(ml_demand, 2)
                    d_conf = 0.91
                    d_deg = False

            tot_gen = round(solar_kw + wind_kw, 2)
            net_surplus = round(tot_gen - demand_kw, 2)
            interval_conf = round((s_conf + w_conf + d_conf) / 3.0, 2)
            interval_deg = s_deg or w_deg or d_deg

            if interval_deg:
                has_degraded = True

            confidences.append(interval_conf)
            intervals.append(
                ForecastInterval(
                    interval_start=t_start,
                    interval_end=t_end,
                    solar_generation_kw=solar_kw,
                    wind_generation_kw=wind_kw,
                    total_generation_kw=tot_gen,
                    campus_demand_kw=demand_kw,
                    net_surplus_kw=net_surplus,
                    confidence=interval_conf,
                    is_degraded=interval_deg,
                    source_method=source_method,
                )
            )

        mean_conf = round(sum(confidences) / len(confidences), 2) if confidences else 1.0

        return CampusForecast(
            site_id=site_id,
            generated_at=now_dt,
            horizon_hours=float(horizon_hours),
            interval_minutes=interval_minutes,
            intervals=intervals,
            mean_confidence=mean_conf,
            is_degraded=has_degraded,
        )
