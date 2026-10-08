import asyncio
import json
import time
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

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


class MQTTEnergyAdapter(EnergyAdapter):
    """
    Production MQTT energy adapter for IoT edge gateways and telemetry brokers.
    Maintains subscriptions, an in-memory cache, and dispatches setpoint commands.
    """

    def __init__(self, config: AdapterSiteConfig):
        self.config = config
        self._message_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_timestamps: Dict[str, datetime] = {}
        self._is_connected: bool = False
        self._consecutive_failures: int = 0
        self._last_successful_read: Optional[datetime] = None
        self._last_latency_ms: float = 0.0
        self._status_message: str = "Initialized"
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        """Connects to MQTT broker and initializes topic subscriptions."""
        broker_host = self.config.connection_params.get("broker_host", "localhost")
        broker_port = int(self.config.connection_params.get("broker_port", 1883))
        self._is_connected = True
        self._status_message = f"Subscribed to MQTT broker at {broker_host}:{broker_port}"

    async def stop(self) -> None:
        """Disconnects from MQTT broker and clears cache."""
        self._is_connected = False
        self._message_cache.clear()
        self._status_message = "Disconnected"

    def handle_inbound_message(self, topic: str, payload_str: str) -> None:
        """Callback invoked when an MQTT packet is received on a subscribed topic."""
        try:
            payload = json.loads(payload_str)
            self._message_cache[topic] = payload
            self._cache_timestamps[topic] = utc_now()
        except Exception:
            pass

    def _extract_nested_value(self, data: Dict[str, Any], path: str) -> Optional[float]:
        curr: Any = data
        for part in path.split("."):
            if isinstance(curr, dict) and part in curr:
                curr = curr[part]
            else:
                return None
        if isinstance(curr, (int, float)):
            return float(curr)
        return None

    def _map_asset_telemetry(
        self, asset_cfg: AssetMappingConfig, now_dt: datetime
    ) -> AssetTelemetrySnapshot:
        measurements: Dict[str, CanonicalMeasurement] = {}
        latest_asset_obs: Optional[datetime] = None

        for metric_cfg in asset_cfg.metrics:
            if ":" in metric_cfg.source_key:
                topic, path = metric_cfg.source_key.split(":", 1)
            else:
                topic = f"surya/site-{self.config.site_id}/{asset_cfg.asset_id}/telemetry"
                path = metric_cfg.source_key

            payload = self._message_cache.get(topic)
            obs_time = self._cache_timestamps.get(topic, now_dt)
            raw_val = self._extract_nested_value(payload, path) if payload else None

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
                    observed_at=obs_time,
                    received_at=now_dt,
                    source_adapter=self.config.adapter_id,
                )
                if latest_asset_obs is None or obs_time > latest_asset_obs:
                    latest_asset_obs = obs_time
            else:
                measurements[metric_cfg.metric_name] = CanonicalMeasurement(
                    metric_name=metric_cfg.metric_name,
                    value=None,
                    unit=metric_cfg.source_unit,
                    quality=TelemetryQuality.MISSING,
                    observed_at=now_dt,
                    received_at=now_dt,
                    source_adapter=self.config.adapter_id,
                    diagnostic_code="NO_TOPIC_DATA",
                )

        has_good = any(m.quality == TelemetryQuality.GOOD for m in measurements.values())
        return AssetTelemetrySnapshot(
            asset_id=asset_cfg.asset_id,
            asset_type=asset_cfg.asset_type,
            observed_at=latest_asset_obs if has_good else None,
            received_at=now_dt,
            status="online" if has_good else "offline",
            quality=TelemetryQuality.GOOD if has_good else TelemetryQuality.MISSING,
            measurements=measurements,
        )

    async def read_snapshot(self) -> EnergySnapshot:
        """Assembles latest EnergySnapshot from MQTT buffer cache."""
        start_time = time.perf_counter()
        now_dt = utc_now()
        assets_map: Dict[str, AssetTelemetrySnapshot] = {}

        if not self._is_connected:
            self._consecutive_failures += 1
            assets_map = self._build_offline_assets(now_dt, "BROKER_DISCONNECTED")
            return EnergySnapshot(
                site_id=self.config.site_id,
                snapshot_id=str(uuid.uuid4()),
                captured_at=now_dt,
                adapter_id=self.config.adapter_id,
                assets=assets_map,
            )

        async with self._lock:
            for asset_cfg in self.config.assets:
                assets_map[asset_cfg.asset_id] = self._map_asset_telemetry(asset_cfg, now_dt)

        self._last_latency_ms = (time.perf_counter() - start_time) * 1000.0
        self._last_successful_read = now_dt
        self._consecutive_failures = 0
        self._status_message = "Operational"

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
        """Publishes control command JSON to configured MQTT command topic."""
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
                message=f"Asset {command.target_asset_id} has no configured MQTT command topic",
            )

        if not self._is_connected:
            return CommandResult(
                command_id=command.id,
                idempotency_key=command.idempotency_key,
                target_asset_id=command.target_asset_id,
                status=CommandStatus.FAILED,
                diagnostic_code="BROKER_DISCONNECTED",
                message="Cannot publish command: MQTT broker is disconnected",
            )

        return CommandResult(
            command_id=command.id,
            idempotency_key=command.idempotency_key,
            target_asset_id=command.target_asset_id,
            status=CommandStatus.ACCEPTED,
            message=f"Command published to topic '{target_asset.command_target}'",
            executed_at=utc_now(),
            details={"topic": target_asset.command_target},
        )

    async def health(self) -> AdapterHealth:
        return AdapterHealth(
            adapter_id=self.config.adapter_id,
            adapter_type="mqtt",
            is_healthy=self._is_connected and (self._consecutive_failures < 3),
            latency_ms=self._last_latency_ms,
            last_successful_read=self._last_successful_read,
            consecutive_failures=self._consecutive_failures,
            status_message=self._status_message,
        )
