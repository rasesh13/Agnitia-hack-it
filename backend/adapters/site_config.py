from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.models.digital_twin import AssetType


class MetricMapping(BaseModel):
    """
    Mapping specification from a hardware source field/register to a canonical metric.
    """

    model_config = ConfigDict(extra="forbid")

    metric_name: str = Field(..., description="Target canonical metric name, e.g. active_power_kw")
    source_key: str = Field(
        ..., description="Protocol key: JSON path, register number, or subtopic"
    )
    source_unit: str = Field("kW", description="Raw engineering unit reported by hardware")
    scale_factor: float = Field(1.0, description="Multiplier to apply before unit normalization")
    offset: float = Field(0.0, description="Additive offset to apply to raw value")


class AssetMappingConfig(BaseModel):
    """
    Configuration mapping for an individual asset within an energy adapter.
    """

    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(..., description="Unique digital twin asset ID")
    asset_type: AssetType = Field(..., description="Classification of the energy asset")
    metrics: List[MetricMapping] = Field(
        default_factory=list, description="List of metric mapping rules for this asset"
    )
    command_target: Optional[str] = Field(
        None, description="Command endpoint, register address, or topic for setpoint writes"
    )


class AdapterSiteConfig(BaseModel):
    """
    Complete configuration bundle for a site energy adapter instance.
    """

    model_config = ConfigDict(extra="forbid")

    site_id: int = Field(..., description="Site identifier")
    adapter_id: str = Field(..., description="Unique adapter instance identifier")
    adapter_type: str = Field(..., description="Adapter protocol: rest, modbus, mqtt, or stub")
    poll_interval_seconds: float = Field(
        5.0, gt=0, description="Target polling interval in seconds"
    )
    timeout_seconds: float = Field(
        10.0, gt=0, description="Network read/write timeout in seconds"
    )
    connection_params: Dict[str, Any] = Field(
        default_factory=dict, description="Protocol connection details (host, port, auth, etc.)"
    )
    assets: List[AssetMappingConfig] = Field(
        default_factory=list, description="Configured assets mapped by this adapter"
    )
