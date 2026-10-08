import pytest

from backend.models.config import BuildingConfig, CriticalityTier, VNMSharingRule
from backend.models.decision_log import DecisionType
from backend.services.vnm_optimizer import (
    VNMOptimizer,
    VNMStrategy,
)


@pytest.fixture
def optimizer() -> VNMOptimizer:
    return VNMOptimizer()


@pytest.fixture
def sample_buildings() -> list[BuildingConfig]:
    return [
        BuildingConfig(
            id=1,
            asset_id="bldg-01",
            building_name="Science Block",
            criticality_tier=CriticalityTier.CRITICAL,
            peak_load_kw=100.0,
        ),
        BuildingConfig(
            id=2,
            asset_id="bldg-02",
            building_name="Library",
            criticality_tier=CriticalityTier.ESSENTIAL,
            peak_load_kw=80.0,
        ),
        BuildingConfig(
            id=3,
            asset_id="bldg-03",
            building_name="Hostel Block",
            criticality_tier=CriticalityTier.NON_CRITICAL,
            peak_load_kw=50.0,
        ),
    ]


@pytest.fixture
def valid_rules() -> list[VNMSharingRule]:
    return [
        VNMSharingRule(
            id=1,
            building_asset_id="bldg-01",
            sharing_ratio=0.50,
            rule_version=1,
            jurisdiction="IN-KA",
        ),
        VNMSharingRule(
            id=2,
            building_asset_id="bldg-02",
            sharing_ratio=0.30,
            rule_version=1,
            jurisdiction="IN-KA",
        ),
        VNMSharingRule(
            id=3,
            building_asset_id="bldg-03",
            sharing_ratio=0.20,
            rule_version=1,
            jurisdiction="IN-KA",
        ),
    ]


def test_validate_rules_success(optimizer: VNMOptimizer, valid_rules: list[VNMSharingRule]):
    is_valid, msg = optimizer.validate_rules(valid_rules)
    assert is_valid is True
    assert "valid" in msg.lower()


def test_validate_rules_negative_ratio(optimizer: VNMOptimizer, valid_rules: list[VNMSharingRule]):
    valid_rules[0].sharing_ratio = -0.10
    is_valid, msg = optimizer.validate_rules(valid_rules)
    assert is_valid is False
    assert "negative" in msg.lower()


def test_validate_rules_duplicate_asset(optimizer: VNMOptimizer, valid_rules: list[VNMSharingRule]):
    valid_rules[1].building_asset_id = "bldg-01"
    is_valid, msg = optimizer.validate_rules(valid_rules)
    assert is_valid is False
    assert "duplicate" in msg.lower()


def test_validate_rules_non_unity_sum(optimizer: VNMOptimizer, valid_rules: list[VNMSharingRule]):
    valid_rules[0].sharing_ratio = 0.80  # sum = 1.30
    is_valid, msg = optimizer.validate_rules(valid_rules, require_unity_sum=True)
    assert is_valid is False
    assert "sum" in msg.lower()


def test_optimize_allocation_proportional(
    optimizer: VNMOptimizer,
    sample_buildings: list[BuildingConfig],
    valid_rules: list[VNMSharingRule],
):
    demands = {
        "bldg-01": 100.0,  # 15 min = 25.0 kWh
        "bldg-02": 80.0,   # 15 min = 20.0 kWh
        "bldg-03": 40.0,   # 15 min = 10.0 kWh
    }
    # Available generation = 30.0 kWh over 15 min
    result = optimizer.optimize_allocation(
        available_generation_kwh=30.0,
        buildings=sample_buildings,
        demands_kw=demands,
        rules=valid_rules,
        strategy=VNMStrategy.PROPORTIONAL,
        duration_minutes=15,
        tariff_inr_per_kwh=8.0,
    )

    assert result.strategy == VNMStrategy.PROPORTIONAL
    assert result.total_available_generation_kwh == 30.0
    assert result.is_compliant is True

    # Check 50% / 30% / 20% splits of 30 kWh: 15 kWh, 9 kWh, 6 kWh
    alloc_map = {a.building_id: a for a in result.allocations}
    assert alloc_map["bldg-01"].allocated_kwh == 15.0
    assert alloc_map["bldg-01"].allocated_value_inr == 120.0  # 15 * 8
    assert alloc_map["bldg-02"].allocated_kwh == 9.0
    assert alloc_map["bldg-02"].allocated_value_inr == 72.0   # 9 * 8
    assert alloc_map["bldg-03"].allocated_kwh == 6.0
    assert alloc_map["bldg-03"].allocated_value_inr == 48.0   # 6 * 8

    assert result.total_allocated_kwh == 30.0
    assert result.total_allocated_value_inr == 240.0
    assert result.surplus_unallocated_kwh == 0.0


def test_optimize_allocation_critical_first(
    optimizer: VNMOptimizer,
    sample_buildings: list[BuildingConfig],
    valid_rules: list[VNMSharingRule],
):
    # Demands: 15 min kWh
    # bldg-01 (CRITICAL): 40 kW -> 10.0 kWh
    # bldg-02 (ESSENTIAL): 40 kW -> 10.0 kWh
    # bldg-03 (NON_CRITICAL): 40 kW -> 10.0 kWh
    demands = {
        "bldg-01": 40.0,
        "bldg-02": 40.0,
        "bldg-03": 40.0,
    }

    # Available generation = 15.0 kWh
    # Only enough for CRITICAL (10 kWh) + half of ESSENTIAL (5 kWh)
    result = optimizer.optimize_allocation(
        available_generation_kwh=15.0,
        buildings=sample_buildings,
        demands_kw=demands,
        rules=valid_rules,
        strategy=VNMStrategy.CRITICAL_FIRST,
        duration_minutes=15,
        tariff_inr_per_kwh=10.0,
    )

    assert result.strategy == VNMStrategy.CRITICAL_FIRST
    alloc_map = {a.building_id: a for a in result.allocations}

    # CRITICAL gets 100% of its demand (10 kWh)
    assert alloc_map["bldg-01"].allocated_kwh == 10.0
    assert alloc_map["bldg-01"].unmet_demand_kwh == 0.0
    assert alloc_map["bldg-01"].allocated_value_inr == 100.0

    # ESSENTIAL gets the remaining 5 kWh
    assert alloc_map["bldg-02"].allocated_kwh == 5.0
    assert alloc_map["bldg-02"].unmet_demand_kwh == 5.0
    assert alloc_map["bldg-02"].allocated_value_inr == 50.0

    # NON_CRITICAL gets 0 kWh
    assert alloc_map["bldg-03"].allocated_kwh == 0.0
    assert alloc_map["bldg-03"].unmet_demand_kwh == 10.0
    assert alloc_map["bldg-03"].allocated_value_inr == 0.0


def test_generate_decision_records(
    optimizer: VNMOptimizer,
    sample_buildings: list[BuildingConfig],
    valid_rules: list[VNMSharingRule],
):
    demands = {"bldg-01": 50.0, "bldg-02": 50.0, "bldg-03": 50.0}
    result = optimizer.optimize_allocation(
        available_generation_kwh=20.0,
        buildings=sample_buildings,
        demands_kw=demands,
        rules=valid_rules,
        strategy=VNMStrategy.PROPORTIONAL,
        duration_minutes=15,
        tariff_inr_per_kwh=8.0,
    )

    records = optimizer.generate_decision_records(
        result=result,
        cycle_id="cycle-vnm-1",
        site_id=1,
    )

    assert len(records) == 3
    for record in records:
        assert record.cycle_id == "cycle-vnm-1"
        assert record.decision_type == DecisionType.VNM_ALLOCATION
        assert record.allocated_kwh is not None
        assert record.allocated_value_inr is not None
        assert "strategy" in record.context_data
        assert "jurisdiction" in record.context_data
