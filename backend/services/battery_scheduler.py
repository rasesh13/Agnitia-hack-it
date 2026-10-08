import math
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field

from backend.models.base import utc_now
from backend.models.config import BatteryConfig
from backend.models.decision_log import DecisionLog, DecisionType
from backend.models.telemetry import AssetCurrentState, TelemetryQuality
from backend.services.forecast_engine import ForecastInterval


class BatteryAction(str, Enum):
    """Action state for battery energy storage system."""

    CHARGE = "charge"
    DISCHARGE = "discharge"
    HOLD = "hold"


class BatteryOperationalLimits(BaseModel):
    """
    Evaluated physical and health limits for a battery asset.
    """

    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(..., description="Battery asset identifier")
    min_soc_pct: float = Field(..., description="Absolute minimum state of charge %")
    max_soc_pct: float = Field(..., description="Absolute maximum state of charge %")
    reserve_floor_pct: float = Field(
        ..., description="Emergency reliability reserve floor %"
    )
    max_charge_kw: float = Field(..., ge=0.0, description="Permitted charging power in kW")
    max_discharge_kw: float = Field(
        ..., ge=0.0, description="Permitted discharging power in kW"
    )
    derating_factor: float = Field(
        1.0, ge=0.0, le=1.0, description="Derating multiplier (1.0 = nominal)"
    )
    derating_reason: Optional[str] = Field(None, description="Reason for power derating")
    is_derated: bool = Field(False, description="True if power is derated")
    is_available: bool = Field(True, description="True if battery is ready for dispatch")


class BatteryDispatchPlan(BaseModel):
    """
    Validated single-interval battery dispatch decision.
    Conforms to SURYA spec Section 11.4.
    """

    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(..., description="Target battery asset identifier")
    action: BatteryAction = Field(..., description="Target dispatch action")
    target_power_kw: float = Field(0.0, ge=0.0, description="Requested power setpoint in kW")
    approved_power_kw: float = Field(
        0.0, ge=0.0, description="Safety-validated power setpoint in kW"
    )
    initial_soc_pct: float = Field(..., ge=0.0, le=100.0, description="Starting SoC %")
    projected_soc_pct: float = Field(
        ..., ge=0.0, le=100.0, description="Expected SoC % after interval"
    )
    energy_delta_kwh: float = Field(
        0.0, description="Net energy change: positive=stored, negative=extracted"
    )
    duration_minutes: int = Field(15, gt=0, description="Dispatch step duration in minutes")
    round_trip_efficiency: float = Field(
        ..., gt=0.0, le=1.0, description="Round-trip efficiency"
    )
    constraint_checks: Dict[str, bool] = Field(
        default_factory=dict, description="Status of physical and safety constraints"
    )
    reason: str = Field(..., description="Engineering explanation for dispatch decision")


class BatteryScheduleHorizon(BaseModel):
    """
    Multi-interval dispatch schedule and projected SoC trajectory.
    """

    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(..., description="Battery asset identifier")
    plans: List[BatteryDispatchPlan] = Field(
        default_factory=list, description="Chronological interval dispatch plans"
    )
    initial_soc_pct: float = Field(..., ge=0.0, le=100.0, description="Initial SoC %")
    final_soc_pct: float = Field(..., ge=0.0, le=100.0, description="Final projected SoC %")
    total_charged_kwh: float = Field(
        0.0, ge=0.0, description="Total energy charged across horizon in kWh"
    )
    total_discharged_kwh: float = Field(
        0.0, ge=0.0, description="Total energy discharged across horizon in kWh"
    )


class BatteryScheduler:
    """
    Battery Dispatch & Storage Scheduler.
    Enforces min/max SoC, charge/discharge power limits, health/temperature constraints,
    round-trip efficiency, and reserve floor boundaries.
    Conforms to SURYA spec Section 11.4 and Section 12.
    """

    def calculate_operational_limits(
        self,
        state: AssetCurrentState,
        config: BatteryConfig,
    ) -> BatteryOperationalLimits:
        """
        Calculates active operational power limits, SoC constraints, and derating.
        """
        is_unavail = (
            state.telemetry_quality in (TelemetryQuality.INVALID, TelemetryQuality.MISSING)
            or state.operational_status == "offline"
        )
        if is_unavail:
            return BatteryOperationalLimits(
                asset_id=state.asset_id,
                min_soc_pct=config.min_soc,
                max_soc_pct=config.max_soc,
                reserve_floor_pct=config.reserve_floor,
                max_charge_kw=0.0,
                max_discharge_kw=0.0,
                derating_factor=0.0,
                derating_reason="Asset offline or invalid telemetry",
                is_derated=True,
                is_available=False,
            )

        derating_factor = 1.0
        derating_reasons: List[str] = []

        # Temperature constraints
        temp_c = state.temperature_celsius
        if temp_c is not None:
            if temp_c > 65.0:
                derating_factor = 0.0
                derating_reasons.append(f"Critical overtemperature ({temp_c:.1f}°C > 65°C)")
            elif temp_c > 55.0:
                derating_factor *= 0.5
                derating_reasons.append(f"High temperature derating ({temp_c:.1f}°C > 55°C)")
            elif temp_c < 0.0:
                derating_reasons.append(f"Sub-zero temperature ({temp_c:.1f}°C < 0°C)")

        # Health (SOH) constraints
        soh_pct = state.health_percent
        if soh_pct is not None and soh_pct < config.health_floor:
            derating_factor *= 0.75
            derating_reasons.append(
                f"Degraded health ({soh_pct:.1f}% < floor {config.health_floor:.1f}%)"
            )

        nom_charge = config.max_charge_power_kw
        nom_discharge = config.max_discharge_power_kw

        active_charge_kw = (
            0.0 if (temp_c is not None and temp_c < 0.0)
            else round(nom_charge * derating_factor, 2)
        )
        active_discharge_kw = round(nom_discharge * derating_factor, 2)
        is_derated = (derating_factor < 1.0) or (temp_c is not None and temp_c < 0.0)

        reason_str = "; ".join(derating_reasons) if derating_reasons else None

        return BatteryOperationalLimits(
            asset_id=state.asset_id,
            min_soc_pct=config.min_soc,
            max_soc_pct=config.max_soc,
            reserve_floor_pct=config.reserve_floor,
            max_charge_kw=active_charge_kw,
            max_discharge_kw=active_discharge_kw,
            derating_factor=round(derating_factor, 2),
            derating_reason=reason_str,
            is_derated=is_derated,
            is_available=derating_factor > 0.0,
        )

    def calculate_soc_delta(
        self,
        power_kw: float,
        action: BatteryAction,
        duration_minutes: int,
        capacity_kwh: float,
        round_trip_efficiency: float,
    ) -> float:
        """
        Calculates change in SoC percentage given power, duration, capacity, and efficiency.
        One-way efficiency is modelled as sqrt(round_trip_efficiency).
        """
        if capacity_kwh <= 0.0 or power_kw <= 0.0 or action == BatteryAction.HOLD:
            return 0.0

        one_way_eff = math.sqrt(max(0.01, min(1.0, round_trip_efficiency)))
        hours = duration_minutes / 60.0

        if action == BatteryAction.CHARGE:
            energy_kwh = power_kw * hours * one_way_eff
            return (energy_kwh / capacity_kwh) * 100.0
        elif action == BatteryAction.DISCHARGE:
            energy_kwh = (power_kw * hours) / one_way_eff
            return -(energy_kwh / capacity_kwh) * 100.0

        return 0.0

    def _evaluate_charge(
        self,
        limits: BatteryOperationalLimits,
        current_soc: float,
        requested_power: float,
        duration_minutes: int,
        capacity_kwh: float,
        rte: float,
        checks: Dict[str, bool],
    ) -> Tuple[BatteryAction, float, float, float, str]:
        approved_power = requested_power
        reasons: List[str] = []

        if approved_power > limits.max_charge_kw:
            approved_power = limits.max_charge_kw
            reasons.append(f"Clamped to max charge power ({limits.max_charge_kw:.1f} kW)")
            checks["charge_rate_within_limits"] = False

        one_way_eff = math.sqrt(rte)
        hours = duration_minutes / 60.0
        room_pct = max(0.0, limits.max_soc_pct - current_soc)
        room_kwh = (room_pct / 100.0) * capacity_kwh
        max_p_by_soc = room_kwh / (hours * one_way_eff) if (hours * one_way_eff) > 0 else 0.0

        if approved_power > max_p_by_soc:
            approved_power = round(max(0.0, max_p_by_soc), 2)
            reasons.append(f"Clamped to prevent exceeding max SoC {limits.max_soc_pct:.1f}%")
            checks["soc_within_bounds"] = False

        soc_delta = self.calculate_soc_delta(
            approved_power, BatteryAction.CHARGE, duration_minutes, capacity_kwh, rte
        )
        projected_soc = min(100.0, round(current_soc + soc_delta, 2))
        energy_delta = round(approved_power * hours * one_way_eff, 2)

        if approved_power <= 0.0:
            return (
                BatteryAction.HOLD,
                0.0,
                current_soc,
                0.0,
                "Battery at maximum SoC capacity limit",
            )

        suffix = f" ({'; '.join(reasons)})" if reasons else ""
        reason = f"Charging at {approved_power:.1f} kW for {duration_minutes}m{suffix}"
        return (BatteryAction.CHARGE, approved_power, projected_soc, energy_delta, reason)

    def _evaluate_discharge(
        self,
        limits: BatteryOperationalLimits,
        current_soc: float,
        requested_power: float,
        duration_minutes: int,
        capacity_kwh: float,
        rte: float,
        is_emergency: bool,
        checks: Dict[str, bool],
    ) -> Tuple[BatteryAction, float, float, float, str]:
        approved_power = requested_power
        reasons: List[str] = []

        if approved_power > limits.max_discharge_kw:
            approved_power = limits.max_discharge_kw
            reasons.append(
                f"Clamped to max discharge power ({limits.max_discharge_kw:.1f} kW)"
            )
            checks["discharge_rate_within_limits"] = False

        floor_pct = limits.min_soc_pct if is_emergency else limits.reserve_floor_pct
        if current_soc < floor_pct:
            approved_power = 0.0
            reasons.append(
                f"Current SoC {current_soc:.1f}% is below operational floor {floor_pct:.1f}%"
            )
            checks["reserve_floor_respected"] = is_emergency

        one_way_eff = math.sqrt(rte)
        hours = duration_minutes / 60.0
        avail_pct = max(0.0, current_soc - floor_pct)
        avail_kwh = (avail_pct / 100.0) * capacity_kwh
        max_p_by_soc = (avail_kwh * one_way_eff) / hours if hours > 0 else 0.0

        if approved_power > max_p_by_soc:
            approved_power = round(max(0.0, max_p_by_soc), 2)
            reasons.append(f"Clamped to maintain reserve floor ({floor_pct:.1f}%)")
            checks["reserve_floor_respected"] = True

        soc_delta = self.calculate_soc_delta(
            approved_power, BatteryAction.DISCHARGE, duration_minutes, capacity_kwh, rte
        )
        projected_soc = max(0.0, round(current_soc + soc_delta, 2))
        energy_delta = round(-(approved_power * hours) / one_way_eff, 2)

        if approved_power <= 0.0:
            return (
                BatteryAction.HOLD,
                0.0,
                current_soc,
                0.0,
                f"Discharge held to protect reserve floor ({floor_pct:.1f}%)",
            )

        suffix = f" ({'; '.join(reasons)})" if reasons else ""
        reason = f"Discharging at {approved_power:.1f} kW for {duration_minutes}m{suffix}"
        return (BatteryAction.DISCHARGE, approved_power, projected_soc, energy_delta, reason)

    def evaluate_dispatch(
        self,
        state: AssetCurrentState,
        config: BatteryConfig,
        capacity_kwh: float,
        requested_action: BatteryAction,
        requested_power_kw: float,
        duration_minutes: int = 15,
        is_emergency: bool = False,
    ) -> BatteryDispatchPlan:
        """
        Evaluates and safety-clamps a requested battery dispatch action.
        Guarantees SoC limits, power bounds, efficiency, and reserve floors.
        """
        limits = self.calculate_operational_limits(state, config)
        current_soc = state.soc_percent if state.soc_percent is not None else 50.0
        rte = config.round_trip_efficiency

        checks = {
            "soc_within_bounds": True,
            "charge_rate_within_limits": True,
            "discharge_rate_within_limits": True,
            "temperature_safe": (
                state.temperature_celsius is None or state.temperature_celsius <= 65.0
            ),
            "health_floor_satisfied": (
                state.health_percent is None or state.health_percent >= config.health_floor
            ),
            "reserve_floor_respected": True,
        }

        if not limits.is_available:
            return BatteryDispatchPlan(
                asset_id=state.asset_id,
                action=BatteryAction.HOLD,
                target_power_kw=requested_power_kw,
                approved_power_kw=0.0,
                initial_soc_pct=current_soc,
                projected_soc_pct=current_soc,
                energy_delta_kwh=0.0,
                duration_minutes=duration_minutes,
                round_trip_efficiency=rte,
                constraint_checks=checks,
                reason=f"Battery unavailable: {limits.derating_reason or 'offline'}",
            )

        if requested_action == BatteryAction.HOLD or requested_power_kw <= 0.0:
            return BatteryDispatchPlan(
                asset_id=state.asset_id,
                action=BatteryAction.HOLD,
                target_power_kw=0.0,
                approved_power_kw=0.0,
                initial_soc_pct=current_soc,
                projected_soc_pct=current_soc,
                energy_delta_kwh=0.0,
                duration_minutes=duration_minutes,
                round_trip_efficiency=rte,
                constraint_checks=checks,
                reason="Battery held in idle state per dispatch plan",
            )

        if requested_action == BatteryAction.CHARGE:
            act, app_p, proj_soc, e_delta, rsn = self._evaluate_charge(
                limits, current_soc, requested_power_kw, duration_minutes, capacity_kwh, rte, checks
            )
        else:
            act, app_p, proj_soc, e_delta, rsn = self._evaluate_discharge(
                limits, current_soc, requested_power_kw, duration_minutes, capacity_kwh, rte,
                is_emergency, checks
            )

        return BatteryDispatchPlan(
            asset_id=state.asset_id,
            action=act,
            target_power_kw=requested_power_kw,
            approved_power_kw=app_p,
            initial_soc_pct=current_soc,
            projected_soc_pct=proj_soc,
            energy_delta_kwh=e_delta,
            duration_minutes=duration_minutes,
            round_trip_efficiency=rte,
            constraint_checks=checks,
            reason=rsn,
        )

    def schedule_horizon(
        self,
        state: AssetCurrentState,
        config: BatteryConfig,
        capacity_kwh: float,
        forecast_intervals: List[ForecastInterval],
        is_emergency: bool = False,
    ) -> BatteryScheduleHorizon:
        """
        Generates multi-interval battery dispatch trajectory based on renewable surplus/deficit.
        """
        plans: List[BatteryDispatchPlan] = []
        current_soc = state.soc_percent if state.soc_percent is not None else 50.0
        initial_soc = current_soc
        total_charged = 0.0
        total_discharged = 0.0

        temp_state = AssetCurrentState(
            asset_id=state.asset_id,
            telemetry_quality=state.telemetry_quality,
            operational_status=state.operational_status,
            temperature_celsius=state.temperature_celsius,
            health_percent=state.health_percent,
            soc_percent=current_soc,
            observed_at=state.observed_at,
            received_at=state.received_at,
        )

        for interval in forecast_intervals:
            duration_mins = int(
                (interval.interval_end - interval.interval_start).total_seconds() / 60.0
            )
            net_surplus = interval.net_surplus_kw

            if net_surplus > 0.0:
                action = BatteryAction.CHARGE
                power = net_surplus
            elif net_surplus < 0.0:
                action = BatteryAction.DISCHARGE
                power = abs(net_surplus)
            else:
                action = BatteryAction.HOLD
                power = 0.0

            plan = self.evaluate_dispatch(
                state=temp_state,
                config=config,
                capacity_kwh=capacity_kwh,
                requested_action=action,
                requested_power_kw=power,
                duration_minutes=duration_mins,
                is_emergency=is_emergency,
            )

            plans.append(plan)
            temp_state.soc_percent = plan.projected_soc_pct

            if plan.action == BatteryAction.CHARGE:
                total_charged += plan.approved_power_kw * (duration_mins / 60.0)
            elif plan.action == BatteryAction.DISCHARGE:
                total_discharged += plan.approved_power_kw * (duration_mins / 60.0)

        final_soc = temp_state.soc_percent if temp_state.soc_percent is not None else initial_soc

        return BatteryScheduleHorizon(
            asset_id=state.asset_id,
            plans=plans,
            initial_soc_pct=initial_soc,
            final_soc_pct=final_soc,
            total_charged_kwh=round(total_charged, 2),
            total_discharged_kwh=round(total_discharged, 2),
        )

    def generate_decision_record(
        self,
        plan: BatteryDispatchPlan,
        cycle_id: str,
        site_id: int,
        confidence: float = 1.0,
        actor: str = "system:battery_scheduler",
        created_at: Optional[datetime] = None,
    ) -> DecisionLog:
        """
        Creates an immutable DecisionLog record for the battery dispatch action.
        """
        setpoint = plan.approved_power_kw if plan.action != BatteryAction.HOLD else 0.0
        allocated_kwh = abs(plan.energy_delta_kwh)

        context = {
            "initial_soc_pct": plan.initial_soc_pct,
            "projected_soc_pct": plan.projected_soc_pct,
            "target_power_kw": plan.target_power_kw,
            "approved_power_kw": plan.approved_power_kw,
            "duration_minutes": plan.duration_minutes,
            "round_trip_efficiency": plan.round_trip_efficiency,
            "constraint_checks": plan.constraint_checks,
        }

        return DecisionLog(
            cycle_id=cycle_id,
            site_id=site_id,
            target_asset_id=plan.asset_id,
            decision_type=DecisionType.BATTERY,
            action=plan.action.value,
            setpoint_kw=setpoint,
            allocated_kwh=allocated_kwh,
            allocated_value_inr=0.0,
            actor=actor,
            reason=plan.reason,
            confidence=confidence,
            expected_savings_inr=0.0,
            carbon_impact_kg=0.0,
            context_data=context,
            created_at=created_at or utc_now(),
        )
