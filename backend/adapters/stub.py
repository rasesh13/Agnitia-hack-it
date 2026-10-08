import uuid
from datetime import datetime
from typing import Dict, List, Optional

from backend.adapters.base import CommandResult, EnergyAdapter
from backend.models.base import utc_now
from backend.models.decision_log import CommandStatus, ControlCommand
from backend.models.telemetry import AdapterHealth, AssetTelemetrySnapshot, EnergySnapshot


class InMemoryTestAdapter(EnergyAdapter):
    """
    Test-only in-memory adapter for unit and integration testing.
    Explicitly scoped to tests: does not generate fake physics, but holds injected static snapshots.
    """

    def __init__(
        self,
        site_id: int = 1,
        adapter_id: str = "test_stub",
        initial_assets: Optional[Dict[str, AssetTelemetrySnapshot]] = None,
    ):
        self.site_id = site_id
        self.adapter_id = adapter_id
        self.assets: Dict[str, AssetTelemetrySnapshot] = initial_assets or {}
        self.received_commands: List[ControlCommand] = []
        self.is_healthy: bool = True
        self.latency_ms: float = 1.0
        self.last_read: Optional[datetime] = None
        self.reject_all_commands: bool = False

    async def start(self) -> None:
        self.is_healthy = True

    async def stop(self) -> None:
        pass

    def set_asset_snapshot(self, asset: AssetTelemetrySnapshot) -> None:
        """Injects an asset snapshot for testing."""
        self.assets[asset.asset_id] = asset

    async def read_snapshot(self) -> EnergySnapshot:
        now_dt = utc_now()
        self.last_read = now_dt
        return EnergySnapshot(
            site_id=self.site_id,
            snapshot_id=str(uuid.uuid4()),
            captured_at=now_dt,
            adapter_id=self.adapter_id,
            assets=self.assets.copy(),
        )

    async def write_command(self, command: ControlCommand) -> CommandResult:
        self.received_commands.append(command)
        if self.reject_all_commands:
            return CommandResult(
                command_id=command.id,
                idempotency_key=command.idempotency_key,
                target_asset_id=command.target_asset_id,
                status=CommandStatus.REJECTED,
                diagnostic_code="TEST_REJECT",
                message="Command rejected by test stub configuration",
            )

        return CommandResult(
            command_id=command.id,
            idempotency_key=command.idempotency_key,
            target_asset_id=command.target_asset_id,
            status=CommandStatus.ACCEPTED,
            message="Command accepted by test stub",
            executed_at=utc_now(),
        )

    async def health(self) -> AdapterHealth:
        return AdapterHealth(
            adapter_id=self.adapter_id,
            adapter_type="stub",
            is_healthy=self.is_healthy,
            latency_ms=self.latency_ms,
            last_successful_read=self.last_read,
            consecutive_failures=0 if self.is_healthy else 1,
            status_message="Test Stub Operational" if self.is_healthy else "Test Stub Degraded",
        )
