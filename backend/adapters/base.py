from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.models.base import utc_now
from backend.models.decision_log import CommandStatus, ControlCommand
from backend.models.telemetry import AdapterHealth, EnergySnapshot


class CommandResult(BaseModel):
    """
    Standardized execution response returned by an EnergyAdapter when processing a ControlCommand.
    Conforms to spec Section 8.4.
    """

    model_config = ConfigDict(extra="forbid")

    command_id: str = Field(..., description="Unique ID of the control command")
    idempotency_key: str = Field(
        ..., description="Idempotency key associated with the command"
    )
    target_asset_id: str = Field(..., description="Target asset identifier")
    status: CommandStatus = Field(
        ..., description="Execution status: accepted, rejected, timeout, failed, executed"
    )
    diagnostic_code: Optional[str] = Field(
        None, description="Vendor or protocol diagnostic code"
    )
    message: str = Field(..., description="Human-readable result summary")
    executed_at: Optional[datetime] = Field(
        default_factory=utc_now, description="Execution timestamp"
    )
    details: Optional[Dict[str, Any]] = Field(
        None, description="Detailed protocol-level response data"
    )


class EnergyAdapter(ABC):
    """
    Abstract vendor-neutral energy adapter interface defined in SURYA spec Section 8.1.
    All hardware protocols (REST, Modbus TCP/RTU, MQTT) implement this contract.
    """

    @abstractmethod
    async def start(self) -> None:
        """Initialize connections, listeners, or sessions."""
        pass

    @abstractmethod
    async def stop(self) -> None:
        """Gracefully release connections, subscriptions, or pools."""
        pass

    @abstractmethod
    async def read_snapshot(self) -> EnergySnapshot:
        """
        Polls or extracts the latest live canonical snapshot from connected field devices.
        """
        pass

    @abstractmethod
    async def write_command(self, command: ControlCommand) -> CommandResult:
        """
        Dispatches an explicit setpoint or control command to the target hardware device.
        """
        pass

    @abstractmethod
    async def health(self) -> AdapterHealth:
        """
        Queries adapter operational status, round-trip latency, and failure metrics.
        """
        pass
