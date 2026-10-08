from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field

from backend.models.config import BatteryConfig, BuildingConfig, CriticalityTier
from backend.models.decision_log import DecisionLog, DecisionType
from backend.models.digital_twin import AssetType
from backend.models.telemetry import AssetCurrentState, TelemetryQuality
from backend.services.digital_twin_store import CampusAggregate


class SheddingRecommendation(BaseModel):
    """
    Deterministic load curtailment order for campus buildings during supply shortfall.
    """

    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(..., description="Target building asset ID")
    building_name: str = Field(..., description="Building name")
    criticality_tier: CriticalityTier = Field(..., description="Criticality ranking")
    current_demand_kw: float = Field(..., description="Current power consumption in kW")
    recommended_shed_kw: float = Field(..., description="Target curtailment in kW")
    is_flexible: bool = Field(..., description="True if load is marked flexible/shiftable")
    priority_rank: int = Field(..., description="Deterministic shedding rank (1=shed first)")
    reason: str = Field(..., description="Engineering explanation for shedding")


class ReliabilityAssessment(BaseModel):
    """
    Comprehensive physical reliability evaluation produced by ReliabilityGuard.
    """

    model_config = ConfigDict(extra="forbid")

    is_secure: bool = Field(..., description="True if supply comfortably covers all demand")
    is_emergency: bool = Field(
        ..., description="True if immediate shedding or protection required"
    )
    shortfall_kw: float = Field(0.0, ge=0.0, description="Projected supply deficit in kW")
    reserve_margin_kw: float = Field(
        0.0, description="Available spinning/battery reserve margin in kW"
    )
    critical_load_covered: bool = Field(
        ..., description="True if Tier 1 critical loads are fully served"
    )
    essential_load_covered: bool = Field(
        ..., description="True if Tier 2 essential loads are served"
    )
    battery_usable_discharge_kw: float = Field(
        0.0, ge=0.0, description="Battery discharge power available for economic dispatch"
    )
    battery_reserve_discharge_kw: float = Field(
        0.0,
        ge=0.0,
        description="Battery discharge power reserved strictly for critical emergencies",
    )
    shedding_recommendations: List[SheddingRecommendation] = Field(
        default_factory=list, description="Deterministic shedding priority list"
    )
    emergency_actions: List[str] = Field(
        default_factory=list, description="List of immediate reliability actions required"
    )
    reason: str = Field(
        "System operating within normal reliability bounds",
        description="Summary rationale",
    )


class ReliabilityGuard:
    """
    Pure reliability engine enforcing physical invariants and emergency protections.
    Conforms strictly to Section 11.2 of SURYA spec.md.
    """

    def calculate_battery_discharge_capacity(
        self,
        battery_states: Dict[str, AssetCurrentState],
        battery_configs: Dict[str, BatteryConfig],
    ) -> Tuple[float, float]:
        """
        Calculates usable economic discharge power and critical reserve discharge power.
        - Economic discharge is available only above reserve_floor.
        - Emergency reserve discharge is available between min_soc and reserve_floor.
        - Below min_soc, discharge power is strictly 0.0 kW.
        """
        usable_kw = 0.0
        reserve_kw = 0.0

        for asset_id, state in battery_states.items():
            cfg = battery_configs.get(asset_id)
            if not cfg:
                continue

            if state.telemetry_quality in (
                TelemetryQuality.INVALID,
                TelemetryQuality.MISSING,
            ):
                continue
            if (
                state.health_percent is not None
                and state.health_percent < cfg.health_floor
            ):
                continue

            soc = state.soc_percent if state.soc_percent is not None else 0.0
            max_discharge = cfg.max_discharge_power_kw

            if state.temperature_celsius is not None and state.temperature_celsius > 55.0:
                max_discharge *= 0.5

            if soc > cfg.reserve_floor:
                usable_fraction = min(
                    1.0, (soc - cfg.reserve_floor) / max(1.0, 100.0 - cfg.reserve_floor)
                )
                usable_kw += max_discharge * usable_fraction
                reserve_fraction = (cfg.reserve_floor - cfg.min_soc) / 100.0
                reserve_kw += max_discharge * reserve_fraction
            elif soc > cfg.min_soc:
                emergency_fraction = (soc - cfg.min_soc) / max(
                    1.0, cfg.reserve_floor - cfg.min_soc
                )
                reserve_kw += max_discharge * emergency_fraction

        return round(usable_kw, 2), round(reserve_kw, 2)

    def assess_campus_reliability(
        self,
        campus_aggregate: CampusAggregate,
        buildings: List[BuildingConfig],
        asset_states: Dict[str, AssetCurrentState],
        battery_configs: Dict[str, BatteryConfig],
        grid_available: bool = True,
        max_grid_import_kw: float = 500.0,
    ) -> ReliabilityAssessment:
        """
        Executes full reliability assessment, checking supply adequacy, reserve margins,
        and generating deterministic shedding priority if deficit exists.
        """
        battery_states = {
            aid: state
            for aid, state in asset_states.items()
            if (state.asset and state.asset.asset_type == AssetType.BATTERY)
            or aid in battery_configs
        }

        usable_batt_kw, reserve_batt_kw = self.calculate_battery_discharge_capacity(
            battery_states, battery_configs
        )

        gen_kw = campus_aggregate.total_generation_kw
        grid_kw = max_grid_import_kw if grid_available else 0.0
        total_supply_capacity = gen_kw + usable_batt_kw + grid_kw

        critical_demand = 0.0
        essential_demand = 0.0
        non_critical_demand = 0.0

        for b in buildings:
            state = asset_states.get(b.asset_id)
            power = (
                state.active_power_kw
                if (state and state.active_power_kw is not None)
                else b.peak_load_kw * 0.5
            )
            if b.criticality_tier == CriticalityTier.CRITICAL:
                critical_demand += power
            elif b.criticality_tier == CriticalityTier.ESSENTIAL:
                essential_demand += power
            else:
                non_critical_demand += power

        total_demand = critical_demand + essential_demand + non_critical_demand
        net_margin = total_supply_capacity - total_demand

        is_secure = net_margin >= 0.0
        shortfall = abs(net_margin) if net_margin < 0.0 else 0.0

        max_emergency_supply = gen_kw + usable_batt_kw + reserve_batt_kw + grid_kw
        critical_covered = max_emergency_supply >= critical_demand
        essential_covered = max_emergency_supply >= (critical_demand + essential_demand)

        shedding_recs: List[SheddingRecommendation] = []
        emergency_actions: List[str] = []

        if shortfall > 0.0 or not grid_available:
            shedding_recs = self._calculate_shedding_priority(
                buildings=buildings,
                asset_states=asset_states,
                target_shed_kw=shortfall,
            )

        is_emergency = False
        reason = "Normal operation: supply satisfies campus demand"

        if not grid_available:
            is_emergency = True
            emergency_actions.append("GRID_OUTAGE_ISLAND_MODE")
            reason = "Grid unavailable: operating in islanded mode with reserve protection"

        if shortfall > 0.0:
            is_emergency = True
            emergency_actions.append(f"LOAD_SHEDDING_REQUIRED_{int(shortfall)}KW")
            reason = (
                f"Capacity shortfall of {round(shortfall, 1)}kW: deterministic shedding active"
            )

        if not critical_covered:
            is_emergency = True
            emergency_actions.append("CRITICAL_LOAD_SHORTFALL_ALARM")
            reason = "CRITICAL ALERT: Total available supply insufficient to cover Tier 1 loads!"

        return ReliabilityAssessment(
            is_secure=is_secure,
            is_emergency=is_emergency,
            shortfall_kw=round(shortfall, 2),
            reserve_margin_kw=round(net_margin, 2),
            critical_load_covered=critical_covered,
            essential_load_covered=essential_covered,
            battery_usable_discharge_kw=usable_batt_kw,
            battery_reserve_discharge_kw=reserve_batt_kw,
            shedding_recommendations=shedding_recs,
            emergency_actions=emergency_actions,
            reason=reason,
        )

    def _calculate_shedding_priority(
        self,
        buildings: List[BuildingConfig],
        asset_states: Dict[str, AssetCurrentState],
        target_shed_kw: float,
    ) -> List[SheddingRecommendation]:
        """
        Produces deterministic shedding order.
        """
        def sort_key(b: BuildingConfig) -> Tuple[int, int, str]:
            if b.criticality_tier == CriticalityTier.NON_CRITICAL:
                tier_score = 0
            elif b.criticality_tier == CriticalityTier.ESSENTIAL:
                tier_score = 1
            else:
                tier_score = 2
            is_flex = b.flexible_load_policy in ("shiftable", "curtailable", "flexible")
            flex_score = 0 if is_flex else 1
            return (tier_score, flex_score, b.asset_id)

        sorted_buildings = sorted(buildings, key=sort_key)
        recommendations: List[SheddingRecommendation] = []
        accumulated_shed = 0.0
        rank = 1

        for b in sorted_buildings:
            state = asset_states.get(b.asset_id)
            current_kw = (
                state.active_power_kw
                if (state and state.active_power_kw is not None)
                else b.peak_load_kw * 0.5
            )

            if current_kw <= 0.0:
                continue

            needed_kw = max(0.0, target_shed_kw - accumulated_shed)
            shed_kw = min(current_kw, needed_kw) if target_shed_kw > 0.0 else current_kw

            is_flex = b.flexible_load_policy in ("shiftable", "curtailable", "flexible")
            tier_str = b.criticality_tier.value.upper()
            tag = "flex" if is_flex else "base"
            recommendations.append(
                SheddingRecommendation(
                    asset_id=b.asset_id,
                    building_name=b.building_name,
                    criticality_tier=b.criticality_tier,
                    current_demand_kw=round(current_kw, 2),
                    recommended_shed_kw=round(shed_kw, 2),
                    is_flexible=is_flex,
                    priority_rank=rank,
                    reason=f"Priority {rank}: Shed Tier {tier_str} ({tag})",
                )
            )
            accumulated_shed += shed_kw
            rank += 1

        return recommendations

    def validate_candidate_action(
        self,
        action_type: str,
        target_asset_id: str,
        setpoint_kw: float,
        battery_configs: Dict[str, BatteryConfig],
        asset_states: Dict[str, AssetCurrentState],
        assessment: ReliabilityAssessment,
    ) -> Tuple[bool, Optional[str]]:
        """
        Enforces hard reliability constraints on candidate optimization decisions.
        """
        is_restricted = assessment.is_emergency or assessment.shortfall_kw > 0
        if action_type == "grid_export" and is_restricted:
            return False, "Grid export prohibited during campus emergency or shortfall"

        if target_asset_id in battery_configs:
            cfg = battery_configs[target_asset_id]
            state = asset_states.get(target_asset_id)
            soc = state.soc_percent if (state and state.soc_percent is not None) else 0.0

            if action_type in ("discharge", "set_discharge_power") and setpoint_kw > 0:
                if soc <= cfg.min_soc:
                    return False, f"Battery SoC ({soc}%) is at or below minimum ({cfg.min_soc}%)"
                if soc <= cfg.reserve_floor and not assessment.is_emergency:
                    return False, f"Discharge prohibited below reserve floor ({cfg.reserve_floor}%)"
                if setpoint_kw > cfg.max_discharge_power_kw:
                    return False, f"Rate ({setpoint_kw}kW) > max ({cfg.max_discharge_power_kw}kW)"

            if action_type in ("charge", "set_charge_power") and setpoint_kw > 0:
                if soc >= cfg.max_soc:
                    return False, f"Battery SoC ({soc}%) is at maximum capacity ({cfg.max_soc}%)"
                if setpoint_kw > cfg.max_charge_power_kw:
                    return False, f"Rate ({setpoint_kw}kW) > max ({cfg.max_charge_power_kw}kW)"

        return True, None

    def generate_emergency_decisions(
        self,
        cycle_id: str,
        site_id: int,
        assessment: ReliabilityAssessment,
    ) -> List[DecisionLog]:
        """
        Constructs immutable emergency DecisionLog records when reliability guard intervenes.
        """
        if not assessment.is_emergency and not assessment.shedding_recommendations:
            return []

        decisions: List[DecisionLog] = []

        for rec in assessment.shedding_recommendations:
            if rec.recommended_shed_kw > 0:
                decisions.append(
                    DecisionLog(
                        cycle_id=cycle_id,
                        site_id=site_id,
                        target_asset_id=rec.asset_id,
                        decision_type=DecisionType.RELIABILITY,
                        action="curtail_load",
                        setpoint_kw=round(-rec.recommended_shed_kw, 2),
                        actor="system:reliability_guard",
                        reason=f"Emergency load curtailment: {rec.reason}",
                        confidence=1.0,
                        context_data={
                            "building_name": rec.building_name,
                            "criticality_tier": rec.criticality_tier.value,
                            "is_flexible": rec.is_flexible,
                            "priority_rank": rec.priority_rank,
                        },
                    )
                )

        return decisions
