import time
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

import httpx

from backend.adapters.base import CommandResult, EnergyAdapter
from backend.adapters.site_config import AdapterSiteConfig, AssetMappingConfig
from backend.models.base import utc_now
from backend.models.decision_log import CommandStatus, ControlCommand
from backend.models.telemetry import (
    AdapterHealth,
    AssetTelemetrySnapshot,
    CanonicalMeasurement,
    EnergySnapshot,
    TelemetryQuality,
)
from backend.services.telemetry_quality import normalize_unit


class RestEnergyAdapter(EnergyAdapter):
    """
    Production REST/HTTP energy adapter for modern campus EMS/BMS and gateway systems.
    Conforms to SURYA spec Section 8.1 and Section 8.2.
    """

    def __init__(self, config: AdapterSiteConfig):
        self.config = config
        self._client: Optional[httpx.AsyncClient] = None
        self._consecutive_failures: int = 0
        self._last_successful_read: Optional[datetime] = None
        self._last_latency_ms: float = 0.0
        self._is_healthy: bool = True
        self._status_message: str = "Initialized"

    async def start(self) -> None:
        """Initializes the underlying HTTP client session."""
        if self._client is None or self._client.is_closed:
            base_url = self.config.connection_params.get("base_url", "")
            headers = self.config.connection_params.get("headers", {})
            self._client = httpx.AsyncClient(
                base_url=base_url,
                headers=headers,
                timeout=httpx.Timeout(self.config.timeout_seconds),
            )
            self._is_healthy = True
            self._status_message = "Connected"

    async def stop(self) -> None:
        """Closes the HTTP client session."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
            self._status_message = "Stopped"

    def _extract_nested_value(self, data: Dict[str, Any], path: str) -> Optional[float]:
        """Extracts numerical value from dot-delimited JSON path."""
        curr: Any = data
        for part in path.split("."):
            if isinstance(curr, dict) and part in curr:
                curr = curr[part]
            else:
                return None
        if isinstance(curr, (int, float)):
            return float(curr)
        return None

    def _map_asset_measurements(
        self, asset_cfg: AssetMappingConfig, payload: Dict[str, Any], now_dt: datetime
    ) -> AssetTelemetrySnapshot:
        """Maps payload fields to canonical measurements for a single asset."""
        measurements: Dict[str, CanonicalMeasurement] = {}
        for metric_cfg in asset_cfg.metrics:
            raw_val = self._extract_nested_value(payload, metric_cfg.source_key)
            if raw_val is not None:
                scaled_val = (raw_val * metric_cfg.scale_factor) + metric_cfg.offset
                norm_val, norm_unit = normalize_unit(
                    metric_cfg.metric_name, scaled_val, metric_cfg.source_unit
                )
                measurements[metric_cfg.metric_name] = CanonicalMeasurement(
                    metric_name=metric_cfg.metric_name,
                    value=norm_val,
                    unit=norm_unit,
                    quality=TelemetryQuality.GOOD,
                    observed_at=now_dt,
                    received_at=now_dt,
                    source_adapter=self.config.adapter_id,
                )
            else:
                measurements[metric_cfg.metric_name] = CanonicalMeasurement(
                    metric_name=metric_cfg.metric_name,
                    value=None,
                    unit=metric_cfg.source_unit,
                    quality=TelemetryQuality.MISSING,
                    observed_at=now_dt,
                    received_at=now_dt,
                    source_adapter=self.config.adapter_id,
                    diagnostic_code="KEY_NOT_FOUND",
                )

        has_good = any(m.quality == TelemetryQuality.GOOD for m in measurements.values())
        return AssetTelemetrySnapshot(
            asset_id=asset_cfg.asset_id,
            asset_type=asset_cfg.asset_type,
            observed_at=now_dt if has_good else None,
            received_at=now_dt,
            status="online" if has_good else "offline",
            quality=TelemetryQuality.GOOD if has_good else TelemetryQuality.MISSING,
            measurements=measurements,
        )

    async def read_snapshot(self) -> EnergySnapshot:
        """Polls REST telemetry endpoint and converts response into canonical EnergySnapshot."""
        if self._client is None or self._client.is_closed:
            await self.start()

        start_time = time.perf_counter()
        telemetry_path = self.config.connection_params.get("telemetry_path", "/telemetry")
        now_dt = utc_now()
        assets_map: Dict[str, AssetTelemetrySnapshot] = {}

        try:
            assert self._client is not None
            response = await self._client.get(telemetry_path)
            self._last_latency_ms = (time.perf_counter() - start_time) * 1000.0

            if response.status_code == 200:
                payload = response.json()
                self._consecutive_failures = 0
                self._last_successful_read = now_dt
                self._is_healthy = True
                self._status_message = "Operational"

                for asset_cfg in self.config.assets:
                    assets_map[asset_cfg.asset_id] = self._map_asset_measurements(
                        asset_cfg, payload, now_dt
                    )
            else:
                self._consecutive_failures += 1
                self._is_healthy = False
                self._status_message = f"HTTP {response.status_code}: {response.text[:100]}"
                assets_map = self._build_offline_assets(now_dt, f"HTTP_{response.status_code}")

        except Exception as exc:
            self._last_latency_ms = (time.perf_counter() - start_time) * 1000.0
            self._consecutive_failures += 1
            self._is_healthy = False
            self._status_message = f"Read failed: {str(exc)}"
            assets_map = self._build_offline_assets(now_dt, "COMMUNICATION_ERROR")

        return EnergySnapshot(
            site_id=self.config.site_id,
            snapshot_id=str(uuid.uuid4()),
            captured_at=now_dt,
            adapter_id=self.config.adapter_id,
            assets=assets_map,
        )

    def _build_offline_assets(
        self, now_dt: datetime, diagnostic_code: str
    ) -> Dict[str, AssetTelemetrySnapshot]:
        """Constructs offline records for configured assets during communication failure."""
        result: Dict[str, AssetTelemetrySnapshot] = {}
        for asset_cfg in self.config.assets:
            measurements: Dict[str, CanonicalMeasurement] = {}
            for metric_cfg in asset_cfg.metrics:
                measurements[metric_cfg.metric_name] = CanonicalMeasurement(
                    metric_name=metric_cfg.metric_name,
                    value=None,
                    unit=metric_cfg.source_unit,
                    quality=TelemetryQuality.MISSING,
                    observed_at=now_dt,
                    received_at=now_dt,
                    source_adapter=self.config.adapter_id,
                    diagnostic_code=diagnostic_code,
                )
            result[asset_cfg.asset_id] = AssetTelemetrySnapshot(
                asset_id=asset_cfg.asset_id,
                asset_type=asset_cfg.asset_type,
                observed_at=None,
                received_at=now_dt,
                status="offline",
                quality=TelemetryQuality.MISSING,
                measurements=measurements,
            )
        return result

    async def write_command(self, command: ControlCommand) -> CommandResult:
        """Dispatches setpoint write command to remote hardware REST endpoint."""
        if self._client is None or self._client.is_closed:
            await self.start()

        target_asset = next(
            (a for a in self.config.assets if a.asset_id == command.target_asset_id), None
        )
        if not target_asset or not target_asset.command_target:
            return CommandResult(
                command_id=command.id,
                idempotency_key=command.idempotency_key,
                target_asset_id=command.target_asset_id,
                status=CommandStatus.REJECTED,
                diagnostic_code="ASSET_UNMAPPED",
                message=f"Asset {command.target_asset_id} has no configured command endpoint",
            )

        payload = {
            "idempotency_key": command.idempotency_key,
            "target_asset_id": command.target_asset_id,
            "action": command.action,
            "requested_setpoint": command.requested_setpoint,
            "unit": command.unit,
            "valid_from": command.valid_from.isoformat(),
            "valid_until": command.valid_until.isoformat(),
            "reason": command.reason,
            "originating_actor": command.originating_actor,
        }

        try:
            assert self._client is not None
            resp = await self._client.post(target_asset.command_target, json=payload)
            return self._handle_command_response(command, resp)
        except httpx.TimeoutException:
            return CommandResult(
                command_id=command.id,
                idempotency_key=command.idempotency_key,
                target_asset_id=command.target_asset_id,
                status=CommandStatus.TIMEOUT,
                diagnostic_code="NETWORK_TIMEOUT",
                message="Timeout waiting for remote device response",
            )
        except Exception as exc:
            return CommandResult(
                command_id=command.id,
                idempotency_key=command.idempotency_key,
                target_asset_id=command.target_asset_id,
                status=CommandStatus.FAILED,
                diagnostic_code="NETWORK_ERROR",
                message=f"Failed to transmit command: {str(exc)}",
            )

    def _handle_command_response(
        self, command: ControlCommand, resp: httpx.Response
    ) -> CommandResult:
        if resp.status_code in (200, 201, 202):
            is_json = resp.headers.get("content-type", "").startswith("application/json")
            details = resp.json() if is_json else {"body": resp.text}
            return CommandResult(
                command_id=command.id,
                idempotency_key=command.idempotency_key,
                target_asset_id=command.target_asset_id,
                status=CommandStatus.ACCEPTED,
                message="Command accepted by remote endpoint",
                executed_at=utc_now(),
                details=details,
            )
        if resp.status_code in (400, 422):
            return CommandResult(
                command_id=command.id,
                idempotency_key=command.idempotency_key,
                target_asset_id=command.target_asset_id,
                status=CommandStatus.REJECTED,
                diagnostic_code=f"HTTP_{resp.status_code}",
                message=f"Command rejected by device: {resp.text[:100]}",
            )
        return CommandResult(
            command_id=command.id,
            idempotency_key=command.idempotency_key,
            target_asset_id=command.target_asset_id,
            status=CommandStatus.FAILED,
            diagnostic_code=f"HTTP_{resp.status_code}",
            message=f"Hardware returned error status {resp.status_code}",
        )

    async def health(self) -> AdapterHealth:
        """Returns live diagnostic health metrics for the REST adapter."""
        return AdapterHealth(
            adapter_id=self.config.adapter_id,
            adapter_type="rest",
            is_healthy=self._is_healthy and (self._consecutive_failures < 3),
            latency_ms=self._last_latency_ms,
            last_successful_read=self._last_successful_read,
            consecutive_failures=self._consecutive_failures,
            status_message=self._status_message,
        )
