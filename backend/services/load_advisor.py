from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.models.base import utc_now
from backend.models.config import BuildingConfig, CriticalityTier
from backend.models.decision_log import DecisionLog, DecisionType
from backend.models.telemetry import AssetCurrentState, TelemetryQuality
from backend.services.forecast_engine import ForecastInterval


class LoadShiftRecommendation(BaseModel):
    """
    Actionable recommendation to time-shift flexible campus electrical load.
    Conforms to SURYA spec Section 11.6.
    """

    model_config = ConfigDict(extra="forbid")

    load_asset_id: str = Field(..., description="Target load or building asset ID")
    building_name: str = Field(..., description="Building display name")
    criticality_tier: CriticalityTier = Field(..., description="Criticality classification")
    shiftable_power_kw: float = Field(
        ..., ge=0.0, description="Available flexible power in kW"
    )
    original_window_start: datetime = Field(
        ..., description="Current scheduled start timestamp"
    )
    recommended_window_start: datetime = Field(
        ..., description="Recommended optimal start timestamp"
    )
    recommended_window_end: datetime = Field(
        ..., description="Recommended optimal end timestamp"
    )
    duration_minutes: int = Field(
        ..., gt=0, description="Estimated duration of shifted operation in minutes"
    )
    expected_surplus_kw: float = Field(
        0.0, ge=0.0, description="Expected renewable surplus available during target window"
    )
    energy_kwh: float = Field(..., ge=0.0, description="Total energy volume in kWh")
    estimated_savings_inr: float = Field(
        0.0, ge=0.0, description="Estimated financial savings in INR from peak avoidance"
    )
    estimated_carbon_reduction_kg: float = Field(
        0.0, ge=0.0, description="Estimated avoided grid carbon emissions in kgCO2e"
    )
    comfort_constraints: Dict[str, Any] = Field(
        default_factory=dict,
        description="Comfort and operational boundary limits (e.g. max delay, temp bounds)",
    )
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Recommendation confidence")
    reason: str = Field(..., description="Plain-language justification for recommendation")


class CampusLoadShiftPlan(BaseModel):
    """
    Campus-wide load flexibility recommendations for the current planning cycle.
    """

    model_config = ConfigDict(extra="forbid")

    site_id: int = Field(..., description="Site identifier")
    generated_at: datetime = Field(
        default_factory=utc_now, description="Recommendation generation timestamp"
    )
    recommendations: List[LoadShiftRecommendation] = Field(
        default_factory=list, description="Active shift recommendations"
    )
    total_shifted_power_kw: float = Field(
        0.0, ge=0.0, description="Total flexible power recommended for shifting in kW"
    )
    total_shifted_energy_kwh: float = Field(
        0.0, ge=0.0, description="Total flexible energy in kWh"
    )
    total_estimated_savings_inr: float = Field(
        0.0, ge=0.0, description="Total estimated monetary savings in INR"
    )
    total_carbon_reduction_kg: float = Field(
        0.0, ge=0.0, description="Total avoided carbon emissions in kgCO2e"
    )


class LoadAdvisor:
    """
    Demand-Side Management & Flexible Load Advisory Engine.
    Identifies flexible building loads, scans forecast horizons for renewable surplus windows,
    and calculates time-shift recommendations respecting comfort constraints.
    Conforms to SURYA spec Section 11.6.
    """

    def is_load_flexible(self, building: BuildingConfig) -> bool:
        """
        Determines whether building load is configured as flexible/shiftable.
        Strictly preserves protected and non-flexible loads untouched.
        """
        policy = (building.flexible_load_policy or "").strip().lower()
        return policy in ("flexible", "shiftable", "interruptible")

    def find_best_surplus_window(
        self,
        forecast_intervals: List[ForecastInterval],
        required_duration_minutes: int,
        required_power_kw: float,
        max_delay_minutes: int = 120,
    ) -> Optional[ForecastInterval]:
        """
        Scans upcoming forecast intervals for the optimal renewable surplus window.
        """
        best_interval: Optional[ForecastInterval] = None
        max_surplus = 0.0

        for interval in forecast_intervals:
            # Check if interval has positive renewable surplus
            if interval.net_surplus_kw > max_surplus and interval.net_surplus_kw >= (
                required_power_kw * 0.5
            ):
                max_surplus = interval.net_surplus_kw
                best_interval = interval

        return best_interval

    def generate_recommendations(
        self,
        site_id: int,
        buildings: List[BuildingConfig],
        asset_states: Dict[str, AssetCurrentState],
        forecast_intervals: List[ForecastInterval],
        peak_tariff_inr_per_kwh: float = 11.50,
        solar_surplus_tariff_inr_per_kwh: float = 3.50,
        grid_emission_factor_kg_per_kwh: float = 0.82,
        max_delay_minutes: int = 180,
    ) -> CampusLoadShiftPlan:
        """
        Generates demand-side shifting recommendations for flexible buildings.
        """
        recommendations: List[LoadShiftRecommendation] = []
        now = utc_now()

        for b in buildings:
            # Strictly ignore non-flexible / protected buildings
            if not self.is_load_flexible(b):
                continue

            state = asset_states.get(b.asset_id)
            if not state or state.telemetry_quality in (
                TelemetryQuality.INVALID,
                TelemetryQuality.MISSING,
            ) or state.operational_status == "offline":
                continue

            active_kw = state.active_power_kw or b.peak_load_kw * 0.5
            if active_kw <= 5.0:
                # Load too small to warrant shifting
                continue

            # Check if there is a surplus window ahead
            duration_mins = 60  # Default 1-hour shifting block
            target_window = self.find_best_surplus_window(
                forecast_intervals=forecast_intervals,
                required_duration_minutes=duration_mins,
                required_power_kw=active_kw,
                max_delay_minutes=max_delay_minutes,
            )

            if not target_window:
                continue

            # Calculate savings
            energy_kwh = active_kw * (duration_mins / 60.0)
            tariff_diff = max(
                0.0, peak_tariff_inr_per_kwh - solar_surplus_tariff_inr_per_kwh
            )
            est_savings = round(energy_kwh * tariff_diff, 2)
            carbon_red = round(energy_kwh * grid_emission_factor_kg_per_kwh, 2)

            comfort_limits = {
                "max_delay_minutes": max_delay_minutes,
                "flexible_policy": b.flexible_load_policy,
                "criticality_tier": b.criticality_tier.value,
            }

            reason = (
                f"Shift {active_kw:.1f} kW load from peak period to solar surplus window "
                f"starting at {target_window.interval_start.strftime('%H:%M')} UTC "
                f"(Surplus: {target_window.net_surplus_kw:.1f} kW, "
                f"Est. Savings: ₹{est_savings:.2f})"
            )

            rec = LoadShiftRecommendation(
                load_asset_id=b.asset_id,
                building_name=b.building_name,
                criticality_tier=b.criticality_tier,
                shiftable_power_kw=round(active_kw, 2),
                original_window_start=now,
                recommended_window_start=target_window.interval_start,
                recommended_window_end=target_window.interval_start
                + timedelta(minutes=duration_mins),
                duration_minutes=duration_mins,
                expected_surplus_kw=round(target_window.net_surplus_kw, 2),
                energy_kwh=round(energy_kwh, 2),
                estimated_savings_inr=est_savings,
                estimated_carbon_reduction_kg=carbon_red,
                comfort_constraints=comfort_limits,
                confidence=round(target_window.confidence, 2),
                reason=reason,
            )
            recommendations.append(rec)

        tot_kw = sum(r.shiftable_power_kw for r in recommendations)
        tot_kwh = sum(r.energy_kwh for r in recommendations)
        tot_sav = sum(r.estimated_savings_inr for r in recommendations)
        tot_carb = sum(r.estimated_carbon_reduction_kg for r in recommendations)

        return CampusLoadShiftPlan(
            site_id=site_id,
            generated_at=now,
            recommendations=recommendations,
            total_shifted_power_kw=round(tot_kw, 2),
            total_shifted_energy_kwh=round(tot_kwh, 2),
            total_estimated_savings_inr=round(tot_sav, 2),
            total_carbon_reduction_kg=round(tot_carb, 2),
        )

    def generate_decision_records(
        self,
        plan: CampusLoadShiftPlan,
        cycle_id: str,
        confidence: float = 1.0,
        actor: str = "system:load_advisor",
        created_at: Optional[datetime] = None,
    ) -> List[DecisionLog]:
        """
        Creates immutable DecisionLog records for flexible load shift recommendations.
        """
        records: List[DecisionLog] = []
        now = created_at or utc_now()

        for rec in plan.recommendations:
            context = {
                "building_name": rec.building_name,
                "criticality_tier": rec.criticality_tier.value,
                "original_start": rec.original_window_start.isoformat(),
                "recommended_start": rec.recommended_window_start.isoformat(),
                "recommended_end": rec.recommended_window_end.isoformat(),
                "expected_surplus_kw": rec.expected_surplus_kw,
                "comfort_constraints": rec.comfort_constraints,
            }

            records.append(
                DecisionLog(
                    cycle_id=cycle_id,
                    site_id=plan.site_id,
                    target_asset_id=rec.load_asset_id,
                    decision_type=DecisionType.LOAD_SHIFT,
                    action="recommend_shift",
                    setpoint_kw=rec.shiftable_power_kw,
                    allocated_kwh=rec.energy_kwh,
                    allocated_value_inr=rec.estimated_savings_inr,
                    actor=actor,
                    reason=rec.reason,
                    confidence=rec.confidence,
                    expected_savings_inr=rec.estimated_savings_inr,
                    carbon_impact_kg=-rec.estimated_carbon_reduction_kg,
                    context_data=context,
                    created_at=now,
                )
            )

        return records
