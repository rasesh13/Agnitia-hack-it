import asyncio
import struct
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional

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


class ModbusEnergyAdapter(EnergyAdapter):
    """
    Production Modbus TCP/RTU energy adapter for inverters, energy meters, and battery BMS.
    Encapsulates async Modbus ADU framing, register decoding, and holding register control.
    """

    def __init__(self, config: AdapterSiteConfig):
        self.config = config
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._transaction_id: int = 0
        self._lock = asyncio.Lock()
        self._consecutive_failures: int = 0
        self._last_successful_read: Optional[datetime] = None
        self._last_latency_ms: float = 0.0
        self._is_healthy: bool = True
        self._status_message: str = "Initialized"

    async def start(self) -> None:
        """Establishes TCP connection to Modbus gateway."""
        host = self.config.connection_params.get("host", "127.0.0.1")
        port = int(self.config.connection_params.get("port", 502))
        try:
            self._reader, self._writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=self.config.timeout_seconds,
            )
            self._is_healthy = True
            self._status_message = f"Connected to Modbus TCP {host}:{port}"
        except Exception as exc:
            self._is_healthy = False
            self._status_message = f"Connection error: {str(exc)}"

    async def stop(self) -> None:
        """Closes TCP stream connection."""
        if self._writer is not None:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception:
                pass
            self._writer = None
            self._reader = None
            self._status_message = "Disconnected"

    def _next_tx_id(self) -> int:
        self._transaction_id = (self._transaction_id + 1) % 65535
        return self._transaction_id

    async def _read_registers(
        self, unit_id: int, start_reg: int, count: int, function_code: int = 3
    ) -> List[int]:
        """
        Transmits Modbus TCP request (FC03 Read Holding or FC04 Read Input).
        """
        if self._writer is None or self._reader is None or self._writer.is_closing():
            await self.start()
        if self._writer is None or self._reader is None:
            raise ConnectionError("Modbus connection not established")

        tx_id = self._next_tx_id()
        # Modbus TCP Header: TxId, ProtoId=0, Length=6, UnitId, FC, Addr, Count
        req_frame = struct.pack(
            ">HHHBBHH", tx_id, 0, 6, unit_id, function_code, start_reg, count
        )

        self._writer.write(req_frame)
        await self._writer.drain()

        # Read 7-byte MBAP header
        header_bytes = await asyncio.wait_for(
            self._reader.readexactly(7), timeout=self.config.timeout_seconds
        )
        _, _, length, _ = struct.unpack(">HHHB", header_bytes)

        # Read remaining PDU bytes
        pdu_bytes = await asyncio.wait_for(
            self._reader.readexactly(length - 1), timeout=self.config.timeout_seconds
        )
        resp_fc = pdu_bytes[0]

        if resp_fc & 0x80:
            exc_code = pdu_bytes[1] if len(pdu_bytes) > 1 else 0
            raise RuntimeError(f"Modbus exception response: FC={resp_fc} Code={exc_code}")

        byte_count = pdu_bytes[1]
        reg_data = pdu_bytes[2 : 2 + byte_count]
        regs = [
            struct.unpack(">H", reg_data[i : i + 2])[0]
            for i in range(0, len(reg_data), 2)
        ]
        return regs

    async def _write_single_register(self, unit_id: int, reg_addr: int, val: int) -> bool:
        """Sends FC06 Write Single Register."""
        if self._writer is None or self._reader is None or self._writer.is_closing():
            await self.start()
        if self._writer is None or self._reader is None:
            raise ConnectionError("Modbus connection not established")

        tx_id = self._next_tx_id()
        req_frame = struct.pack(">HHHBBHH", tx_id, 0, 6, unit_id, 6, reg_addr, val)
        self._writer.write(req_frame)
        await self._writer.drain()

        resp = await asyncio.wait_for(
            self._reader.readexactly(12), timeout=self.config.timeout_seconds
        )
        return len(resp) == 12

    def _decode_metric_value(
        self, raw_regs: List[int], reg_offset: int, format_type: str = "uint16"
    ) -> Optional[float]:
        """Decodes raw registers based on format type (uint16, int16, float32, uint32)."""
        if reg_offset >= len(raw_regs):
            return None

        if format_type in ("uint16", "u16"):
            return float(raw_regs[reg_offset])
        if format_type in ("int16", "s16"):
            raw = raw_regs[reg_offset]
            return float(raw if raw < 32768 else raw - 65536)
        if format_type in ("float32", "f32") and reg_offset + 1 < len(raw_regs):
            high = raw_regs[reg_offset]
            low = raw_regs[reg_offset + 1]
            raw_bytes = struct.pack(">HH", high, low)
            return float(struct.unpack(">f", raw_bytes)[0])
        if format_type in ("uint32", "u32") and reg_offset + 1 < len(raw_regs):
            high = raw_regs[reg_offset]
            low = raw_regs[reg_offset + 1]
            return float((high << 16) | low)

        return float(raw_regs[reg_offset])

    async def _poll_asset(
        self, asset_cfg: AssetMappingConfig, unit_id: int, now_dt: datetime
    ) -> AssetTelemetrySnapshot:
        measurements: Dict[str, CanonicalMeasurement] = {}
        for metric_cfg in asset_cfg.metrics:
            parts = metric_cfg.source_key.split(":")
            reg_addr = int(parts[0])
            fmt = parts[1] if len(parts) > 1 else "uint16"
            reg_count = 2 if fmt in ("float32", "uint32") else 1

            try:
                regs = await self._read_registers(unit_id, reg_addr, reg_count)
                raw_val = self._decode_metric_value(regs, 0, fmt)
            except Exception:
                raw_val = None

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
                    diagnostic_code="REG_READ_TIMEOUT",
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
        """Polls configured registers and converts into canonical EnergySnapshot."""
        start_time = time.perf_counter()
        now_dt = utc_now()
        assets_map: Dict[str, AssetTelemetrySnapshot] = {}
        unit_id = int(self.config.connection_params.get("unit_id", 1))

        async with self._lock:
            try:
                for asset_cfg in self.config.assets:
                    assets_map[asset_cfg.asset_id] = await self._poll_asset(
                        asset_cfg, unit_id, now_dt
                    )

                self._consecutive_failures = 0
                self._last_successful_read = now_dt
                self._is_healthy = True
                self._status_message = "Operational"

            except Exception as exc:
                self._consecutive_failures += 1
                self._is_healthy = False
                self._status_message = f"Modbus read failed: {str(exc)}"
                assets_map = self._build_offline_assets(now_dt, "MODBUS_ERROR")

            self._last_latency_ms = (time.perf_counter() - start_time) * 1000.0

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
        """Writes setpoint to Modbus holding register."""
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
                message=f"Asset {command.target_asset_id} has no configured Modbus register",
            )

        unit_id = int(self.config.connection_params.get("unit_id", 1))
        reg_addr = int(target_asset.command_target)
        int_val = int(round(command.requested_setpoint))

        async with self._lock:
            try:
                ok = await self._write_single_register(unit_id, reg_addr, int_val)
                if ok:
                    return CommandResult(
                        command_id=command.id,
                        idempotency_key=command.idempotency_key,
                        target_asset_id=command.target_asset_id,
                        status=CommandStatus.ACCEPTED,
                        message=f"Modbus register {reg_addr} set to {int_val}",
                        executed_at=utc_now(),
                    )
                return CommandResult(
                    command_id=command.id,
                    idempotency_key=command.idempotency_key,
                    target_asset_id=command.target_asset_id,
                    status=CommandStatus.FAILED,
                    diagnostic_code="WRITE_NACK",
                    message="Device did not acknowledge register write",
                )
            except asyncio.TimeoutError:
                return CommandResult(
                    command_id=command.id,
                    idempotency_key=command.idempotency_key,
                    target_asset_id=command.target_asset_id,
                    status=CommandStatus.TIMEOUT,
                    diagnostic_code="MODBUS_TIMEOUT",
                    message="Timeout communicating with Modbus device",
                )
            except Exception as exc:
                return CommandResult(
                    command_id=command.id,
                    idempotency_key=command.idempotency_key,
                    target_asset_id=command.target_asset_id,
                    status=CommandStatus.FAILED,
                    diagnostic_code="MODBUS_ERROR",
                    message=f"Write error: {str(exc)}",
                )

    async def health(self) -> AdapterHealth:
        return AdapterHealth(
            adapter_id=self.config.adapter_id,
            adapter_type="modbus",
            is_healthy=self._is_healthy and (self._consecutive_failures < 3),
            latency_ms=self._last_latency_ms,
            last_successful_read=self._last_successful_read,
            consecutive_failures=self._consecutive_failures,
            status_message=self._status_message,
        )
