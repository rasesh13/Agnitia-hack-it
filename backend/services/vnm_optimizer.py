from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field

from backend.models.base import utc_now
from backend.models.config import BuildingConfig, CriticalityTier, VNMSharingRule
from backend.models.decision_log import DecisionLog, DecisionType


class VNMStrategy(str, Enum):
    """Virtual Net Metering allocation strategy."""

    PROPORTIONAL = "proportional"
    CRITICAL_FIRST = "critical_first"


class BuildingVNMAllocation(BaseModel):
    """
    Allocated renewable generation credit and monetary valuation for a building.
    Conforms to SURYA spec Section 11.5.
    """

    model_config = ConfigDict(extra="forbid")

    building_id: str = Field(..., description="Building asset identifier")
    building_name: str = Field(..., description="Building display name")
    criticality_tier: CriticalityTier = Field(..., description="Building criticality tier")
    demand_kw: float = Field(0.0, ge=0.0, description="Active power demand in kW")
    demand_kwh: float = Field(0.0, ge=0.0, description="Interval energy demand in kWh")
    configured_ratio: float = Field(
        0.0, ge=0.0, le=1.0, description="Configured VNM sharing ratio"
    )
    allocated_kwh: float = Field(
        0.0, ge=0.0, description="Allocated renewable energy credit in kWh"
    )
    allocated_value_inr: float = Field(
        0.0, ge=0.0, description="Monetary valuation in INR"
    )
    tariff_inr_per_kwh: float = Field(
        0.0, ge=0.0, description="Applied billing tariff in INR/kWh"
    )
    unmet_demand_kwh: float = Field(
        0.0, ge=0.0, description="Remaining demand requiring grid/battery power"
    )
    jurisdiction: str = Field("IN-KA", description="Configured regulatory jurisdiction")
    rule_version: int = Field(1, description="VNM sharing rule version")


class VNMAllocationResult(BaseModel):
    """
    Campus-wide Virtual Net Metering allocation summary.
    """

    model_config = ConfigDict(extra="forbid")

    strategy: VNMStrategy = Field(..., description="Applied allocation algorithm")
    total_available_generation_kwh: float = Field(
        0.0, ge=0.0, description="Total renewable generation available for sharing in kWh"
    )
    total_allocated_kwh: float = Field(
        0.0, ge=0.0, description="Total allocated credits across all buildings in kWh"
    )
    total_allocated_value_inr: float = Field(
        0.0, ge=0.0, description="Total financial valuation of allocated credits in INR"
    )
    surplus_unallocated_kwh: float = Field(
        0.0, ge=0.0, description="Surplus generation remaining after allocation in kWh"
    )
    allocations: List[BuildingVNMAllocation] = Field(
        default_factory=list, description="Per-building allocation records"
    )
    jurisdiction: str = Field("IN-KA", description="Active regulatory jurisdiction")
    rule_version: int = Field(1, description="Active VNM rule version")
    is_compliant: bool = Field(
        True, description="True if sharing rules and jurisdiction requirements are met"
    )
    compliance_note: str = Field(
        ..., description="Regulatory compliance and audit disclosure note"
    )


class VNMOptimizer:
    """
    Virtual Net Metering (VNM/GNM) Optimizer.
    Allocates generated renewable energy credits across multi-building campuses
    using Proportional and Critical-First sharing policies with tariff tracking and
    regulatory audit compliance.
    Conforms to SURYA spec Section 11.5.
    """

    def validate_rules(
        self,
        rules: List[VNMSharingRule],
        require_unity_sum: bool = True,
    ) -> Tuple[bool, str]:
        """
        Validates configured sharing rules for non-negativity and sum conformity.
        """
        if not rules:
            return False, "No VNM sharing rules configured"

        seen_assets = set()
        total_ratio = 0.0

        for r in rules:
            if r.building_asset_id in seen_assets:
                return False, f"Duplicate sharing rule for asset {r.building_asset_id}"
            seen_assets.add(r.building_asset_id)

            if r.sharing_ratio < 0.0:
                return False, f"Negative sharing ratio for asset {r.building_asset_id}"
            total_ratio += r.sharing_ratio

        if require_unity_sum and abs(total_ratio - 1.0) > 0.001:
            return (
                False,
                f"Sharing ratios sum to {total_ratio:.4f}, expected 1.0 (unity)",
            )

        return True, "Sharing rules valid and verified"

    def _allocate_proportional(
        self,
        available_kwh: float,
        building_info: List[Dict],
        tariff: float,
        jurisdiction: str,
        rule_version: int,
    ) -> List[BuildingVNMAllocation]:
        allocations: List[BuildingVNMAllocation] = []

        total_configured_ratio = sum(b["ratio"] for b in building_info)
        norm_factor = (
            (1.0 / total_configured_ratio) if total_configured_ratio > 0.0 else 1.0
        )

        for b in building_info:
            normalized_ratio = b["ratio"] * norm_factor
            raw_allocated = available_kwh * normalized_ratio
            # Allocated credit offsets building demand up to demand_kwh
            allocated_kwh = min(b["demand_kwh"], raw_allocated)
            unmet = max(0.0, b["demand_kwh"] - allocated_kwh)
            val_inr = round(allocated_kwh * tariff, 2)

            allocations.append(
                BuildingVNMAllocation(
                    building_id=b["asset_id"],
                    building_name=b["name"],
                    criticality_tier=b["tier"],
                    demand_kw=round(b["demand_kw"], 2),
                    demand_kwh=round(b["demand_kwh"], 2),
                    configured_ratio=round(b["ratio"], 4),
                    allocated_kwh=round(allocated_kwh, 2),
                    allocated_value_inr=val_inr,
                    tariff_inr_per_kwh=round(tariff, 2),
                    unmet_demand_kwh=round(unmet, 2),
                    jurisdiction=jurisdiction,
                    rule_version=rule_version,
                )
            )

        return allocations

    def _allocate_critical_first(
        self,
        available_kwh: float,
        building_info: List[Dict],
        tariff: float,
        jurisdiction: str,
        rule_version: int,
    ) -> List[BuildingVNMAllocation]:
        # Group buildings by priority: CRITICAL -> ESSENTIAL -> NON_CRITICAL
        tier_order = [
            CriticalityTier.CRITICAL,
            CriticalityTier.ESSENTIAL,
            CriticalityTier.NON_CRITICAL,
        ]

        remaining_gen = available_kwh
        allocated_by_id: Dict[str, float] = {b["asset_id"]: 0.0 for b in building_info}

        for tier in tier_order:
            tier_buildings = [b for b in building_info if b["tier"] == tier]
            if not tier_buildings or remaining_gen <= 0.0:
                continue

            tier_demand = sum(b["demand_kwh"] for b in tier_buildings)
            if remaining_gen >= tier_demand:
                # Fully satisfy entire tier demand
                for b in tier_buildings:
                    allocated_by_id[b["asset_id"]] = b["demand_kwh"]
                remaining_gen -= tier_demand
            else:
                # Distribute remaining_gen proportionally within tier according to ratio or demand
                tier_ratio_sum = sum(b["ratio"] for b in tier_buildings)
                for b in tier_buildings:
                    share_fraction = (
                        (b["ratio"] / tier_ratio_sum)
                        if tier_ratio_sum > 0
                        else (b["demand_kwh"] / tier_demand if tier_demand > 0 else 0)
                    )
                    alloc = min(b["demand_kwh"], remaining_gen * share_fraction)
                    allocated_by_id[b["asset_id"]] = alloc
                remaining_gen = 0.0

        allocations: List[BuildingVNMAllocation] = []
        for b in building_info:
            alloc_kwh = allocated_by_id[b["asset_id"]]
            unmet = max(0.0, b["demand_kwh"] - alloc_kwh)
            val_inr = round(alloc_kwh * tariff, 2)

            allocations.append(
                BuildingVNMAllocation(
                    building_id=b["asset_id"],
                    building_name=b["name"],
                    criticality_tier=b["tier"],
                    demand_kw=round(b["demand_kw"], 2),
                    demand_kwh=round(b["demand_kwh"], 2),
                    configured_ratio=round(b["ratio"], 4),
                    allocated_kwh=round(alloc_kwh, 2),
                    allocated_value_inr=val_inr,
                    tariff_inr_per_kwh=round(tariff, 2),
                    unmet_demand_kwh=round(unmet, 2),
                    jurisdiction=jurisdiction,
                    rule_version=rule_version,
                )
            )

        return allocations

    def optimize_allocation(
        self,
        available_generation_kwh: float,
        buildings: List[BuildingConfig],
        demands_kw: Dict[str, float],
        rules: List[VNMSharingRule],
        strategy: VNMStrategy = VNMStrategy.PROPORTIONAL,
        duration_minutes: int = 15,
        tariff_inr_per_kwh: float = 8.50,
        jurisdiction: str = "IN-KA",
        rule_version: int = 1,
    ) -> VNMAllocationResult:
        """
        Executes VNM allocation optimizing monetary value or reliability protection.
        """
        is_valid, validation_msg = self.validate_rules(rules, require_unity_sum=False)
        rule_map = {r.building_asset_id: r for r in rules}

        hours = duration_minutes / 60.0
        building_info = []

        for b in buildings:
            asset_id = b.asset_id
            dem_kw = max(0.0, demands_kw.get(asset_id, 0.0))
            dem_kwh = dem_kw * hours
            rule = rule_map.get(asset_id)
            ratio = rule.sharing_ratio if rule else 0.0

            building_info.append({
                "asset_id": asset_id,
                "name": b.building_name,
                "tier": b.criticality_tier,
                "demand_kw": dem_kw,
                "demand_kwh": dem_kwh,
                "ratio": ratio,
            })

        if strategy == VNMStrategy.PROPORTIONAL:
            allocations = self._allocate_proportional(
                available_kwh=available_generation_kwh,
                building_info=building_info,
                tariff=tariff_inr_per_kwh,
                jurisdiction=jurisdiction,
                rule_version=rule_version,
            )
        else:
            allocations = self._allocate_critical_first(
                available_kwh=available_generation_kwh,
                building_info=building_info,
                tariff=tariff_inr_per_kwh,
                jurisdiction=jurisdiction,
                rule_version=rule_version,
            )

        tot_allocated_kwh = sum(a.allocated_kwh for a in allocations)
        tot_allocated_val = sum(a.allocated_value_inr for a in allocations)
        surplus_kwh = max(0.0, available_generation_kwh - tot_allocated_kwh)

        compliance_note = (
            f"VNM credit allocation computed under {jurisdiction} "
            f"guidelines (Rule v{rule_version}). "
            f"Validation status: {validation_msg}."
        )

        return VNMAllocationResult(
            strategy=strategy,
            total_available_generation_kwh=round(available_generation_kwh, 2),
            total_allocated_kwh=round(tot_allocated_kwh, 2),
            total_allocated_value_inr=round(tot_allocated_val, 2),
            surplus_unallocated_kwh=round(surplus_kwh, 2),
            allocations=allocations,
            jurisdiction=jurisdiction,
            rule_version=rule_version,
            is_compliant=is_valid,
            compliance_note=compliance_note,
        )

    def generate_decision_records(
        self,
        result: VNMAllocationResult,
        cycle_id: str,
        site_id: int,
        confidence: float = 1.0,
        actor: str = "system:vnm_optimizer",
        created_at: Optional[datetime] = None,
    ) -> List[DecisionLog]:
        """
        Creates immutable DecisionLog records for each building VNM credit allocation.
        """
        records: List[DecisionLog] = []
        now = created_at or utc_now()

        for alloc in result.allocations:
            context = {
                "strategy": result.strategy.value,
                "building_name": alloc.building_name,
                "criticality_tier": alloc.criticality_tier.value,
                "configured_ratio": alloc.configured_ratio,
                "demand_kwh": alloc.demand_kwh,
                "unmet_demand_kwh": alloc.unmet_demand_kwh,
                "tariff_inr_per_kwh": alloc.tariff_inr_per_kwh,
                "jurisdiction": alloc.jurisdiction,
                "rule_version": alloc.rule_version,
            }

            reason = (
                f"VNM credit of {alloc.allocated_kwh:.2f} kWh (₹{alloc.allocated_value_inr:.2f}) "
                f"allocated via {result.strategy.value} strategy"
            )

            records.append(
                DecisionLog(
                    cycle_id=cycle_id,
                    site_id=site_id,
                    target_asset_id=alloc.building_id,
                    decision_type=DecisionType.VNM_ALLOCATION,
                    action="credit_allocation",
                    setpoint_kw=round(alloc.allocated_kwh / (15 / 60.0), 2),
                    allocated_kwh=alloc.allocated_kwh,
                    allocated_value_inr=alloc.allocated_value_inr,
                    actor=actor,
                    reason=reason,
                    confidence=confidence,
                    expected_savings_inr=alloc.allocated_value_inr,
                    carbon_impact_kg=0.0,
                    context_data=context,
                    created_at=now,
                )
            )

        return records
