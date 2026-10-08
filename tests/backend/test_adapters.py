import json
import struct
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from backend.adapters import (
    AdapterSiteConfig,
    AssetMappingConfig,
    CommandResult,
    InMemoryTestAdapter,
    MetricMapping,
    ModbusEnergyAdapter,
    MQTTEnergyAdapter,
    RestEnergyAdapter,
)
from backend.models.decision_log import CommandStatus, ControlCommand
from backend.models.digital_twin import AssetType
from backend.models.telemetry import TelemetryQuality


@pytest.fixture
def sample_site_config() -> AdapterSiteConfig:
    return AdapterSiteConfig(
        site_id=1,
        adapter_id="rest_primary",
        adapter_type="rest",
        poll_interval_seconds=5.0,
        timeout_seconds=5.0,
        connection_params={
            "base_url": "http://192.168.1.100:8080",
            "telemetry_path": "/api/v1/telemetry",
        },
        assets=[
            AssetMappingConfig(
                asset_id="solar-01",
                asset_type=AssetType.SOLAR,
                metrics=[
                    MetricMapping(
                        metric_name="active_power_kw",
                        source_key="inverter.power_watts",
                        source_unit="W",
                        scale_factor=1.0,
                    ),
                    MetricMapping(
                        metric_name="energy_kwh",
                        source_key="inverter.total_kwh",
                        source_unit="kWh",
                        scale_factor=1.0,
                    ),
                ],
                command_target="/api/v1/control/solar-01",
            ),
            AssetMappingConfig(
                asset_id="batt-01",
                asset_type=AssetType.BATTERY,
                metrics=[
                    MetricMapping(
                        metric_name="battery_soc",
                        source_key="battery.soc_ratio",
                        source_unit="fraction",
                        scale_factor=1.0,
                    ),
                    MetricMapping(
                        metric_name="temperature_celsius",
                        source_key="battery.temp_f",
                        source_unit="F",
                        scale_factor=1.0,
                    ),
                ],
                command_target="/api/v1/control/batt-01",
            ),
        ],
    )


@pytest.mark.asyncio
async def test_rest_adapter_read_snapshot_success(sample_site_config):
    mock_payload = {
        "inverter": {
            "power_watts": 45000.0,
            "total_kwh": 1250.5,
        },
        "battery": {
            "soc_ratio": 0.82,
            "temp_f": 77.0,  # 25 C
        },
    }

    adapter = RestEnergyAdapter(sample_site_config)

    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, json=mock_payload)
    )
    adapter._client = httpx.AsyncClient(transport=transport, base_url="http://192.168.1.100:8080")

    snapshot = await adapter.read_snapshot()
    assert snapshot.site_id == 1
    assert snapshot.adapter_id == "rest_primary"
    assert "solar-01" in snapshot.assets
    assert "batt-01" in snapshot.assets

    solar_snap = snapshot.assets["solar-01"]
    assert solar_snap.status == "online"
    assert solar_snap.quality == TelemetryQuality.GOOD
    assert solar_snap.measurements["active_power_kw"].value == pytest.approx(45.0)
    assert solar_snap.measurements["active_power_kw"].unit == "kW"

    batt_snap = snapshot.assets["batt-01"]
    assert batt_snap.status == "online"
    assert batt_snap.measurements["battery_soc"].value == pytest.approx(82.0)
    assert batt_snap.measurements["battery_soc"].unit == "%"
    assert batt_snap.measurements["temperature_celsius"].value == pytest.approx(25.0)
    assert batt_snap.measurements["temperature_celsius"].unit == "C"

    health = await adapter.health()
    assert health.is_healthy is True
    assert health.consecutive_failures == 0

    await adapter.stop()


@pytest.mark.asyncio
async def test_rest_adapter_read_snapshot_error(sample_site_config):
    adapter = RestEnergyAdapter(sample_site_config)

    transport = httpx.MockTransport(
        lambda request: httpx.Response(500, text="Internal Gateway Error")
    )
    adapter._client = httpx.AsyncClient(transport=transport, base_url="http://192.168.1.100:8080")

    snapshot = await adapter.read_snapshot()
    assert snapshot.assets["solar-01"].status == "offline"
    assert snapshot.assets["solar-01"].quality == TelemetryQuality.MISSING

    health = await adapter.health()
    assert health.consecutive_failures == 1

    await adapter.stop()


@pytest.mark.asyncio
async def test_rest_adapter_write_command_accepted(sample_site_config):
    adapter = RestEnergyAdapter(sample_site_config)

    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, json={"status": "setpoint_applied"})
    )
    adapter._client = httpx.AsyncClient(transport=transport, base_url="http://192.168.1.100:8080")

    now = datetime.now(timezone.utc)
    cmd = ControlCommand(
        id="cmd-123",
        idempotency_key="idemp-123",
        target_asset_id="batt-01",
        action="set_charge_power",
        requested_setpoint=25.0,
        unit="kW",
        valid_from=now,
        valid_until=now + timedelta(minutes=15),
        reason="Charge from solar surplus",
        originating_actor="system:optimizer",
    )

    result = await adapter.write_command(cmd)
    assert isinstance(result, CommandResult)
    assert result.status == CommandStatus.ACCEPTED
    assert result.command_id == "cmd-123"

    await adapter.stop()


@pytest.mark.asyncio
async def test_rest_adapter_write_command_unmapped(sample_site_config):
    adapter = RestEnergyAdapter(sample_site_config)
    now = datetime.now(timezone.utc)
    cmd = ControlCommand(
        id="cmd-999",
        idempotency_key="idemp-999",
        target_asset_id="unknown-asset",
        action="curtail",
        requested_setpoint=0.0,
        unit="kW",
        valid_from=now,
        valid_until=now + timedelta(minutes=5),
        reason="Emergency curtailment",
        originating_actor="system:optimizer",
    )

    result = await adapter.write_command(cmd)
    assert result.status == CommandStatus.REJECTED
    assert result.diagnostic_code == "ASSET_UNMAPPED"


@pytest.mark.asyncio
async def test_modbus_adapter_read_snapshot():
    modbus_config = AdapterSiteConfig(
        site_id=1,
        adapter_id="modbus_inverter",
        adapter_type="modbus",
        connection_params={"host": "127.0.0.1", "port": 502, "unit_id": 1},
        assets=[
            AssetMappingConfig(
                asset_id="solar-02",
                asset_type=AssetType.SOLAR,
                metrics=[
                    MetricMapping(
                        metric_name="active_power_kw",
                        source_key="100:float32",
                        source_unit="kW",
                    ),
                ],
                command_target="500",
            )
        ],
    )

    adapter = ModbusEnergyAdapter(modbus_config)

    # Mock _read_registers to return float32 for 15.5 kW
    # 15.5 in float32 is 0x41780000 -> registers [0x4178, 0x0000] = [16760, 0]
    float_bytes = struct.pack(">f", 15.5)
    r1, r2 = struct.unpack(">HH", float_bytes)

    with patch.object(adapter, "_read_registers", new_callable=AsyncMock) as mock_read:
        mock_read.return_value = [r1, r2]
        snapshot = await adapter.read_snapshot()

    assert "solar-02" in snapshot.assets
    assert snapshot.assets["solar-02"].status == "online"
    assert snapshot.assets["solar-02"].measurements["active_power_kw"].value == pytest.approx(15.5)


@pytest.mark.asyncio
async def test_modbus_adapter_write_command():
    modbus_config = AdapterSiteConfig(
        site_id=1,
        adapter_id="modbus_batt",
        adapter_type="modbus",
        connection_params={"host": "127.0.0.1", "port": 502, "unit_id": 1},
        assets=[
            AssetMappingConfig(
                asset_id="batt-02",
                asset_type=AssetType.BATTERY,
                command_target="200",
            )
        ],
    )

    adapter = ModbusEnergyAdapter(modbus_config)
    now = datetime.now(timezone.utc)
    cmd = ControlCommand(
        id="cmd-mb-1",
        idempotency_key="idemp-mb-1",
        target_asset_id="batt-02",
        action="set_power",
        requested_setpoint=50.0,
        unit="kW",
        valid_from=now,
        valid_until=now + timedelta(minutes=10),
        reason="Peak shaving dispatch",
        originating_actor="system:optimizer",
    )

    with patch.object(adapter, "_write_single_register", new_callable=AsyncMock) as mock_write:
        mock_write.return_value = True
        res = await adapter.write_command(cmd)

    assert res.status == CommandStatus.ACCEPTED
    assert "200" in res.message


@pytest.mark.asyncio
async def test_mqtt_adapter():
    mqtt_config = AdapterSiteConfig(
        site_id=1,
        adapter_id="mqtt_meters",
        adapter_type="mqtt",
        connection_params={"broker_host": "localhost", "broker_port": 1883},
        assets=[
            AssetMappingConfig(
                asset_id="grid-meter-01",
                asset_type=AssetType.METER,
                metrics=[
                    MetricMapping(
                        metric_name="active_power_kw",
                        source_key="power_kw",
                        source_unit="kW",
                    ),
                    MetricMapping(
                        metric_name="voltage_v",
                        source_key="grid.voltage",
                        source_unit="V",
                    ),
                ],
                command_target="surya/site-1/grid-meter-01/setpoint",
            )
        ],
    )

    adapter = MQTTEnergyAdapter(mqtt_config)
    await adapter.start()

    # Feed inbound message
    telemetry_topic = "surya/site-1/grid-meter-01/telemetry"
    sample_msg = json.dumps({"power_kw": 85.2, "grid": {"voltage": 415.0}})
    adapter.handle_inbound_message(telemetry_topic, sample_msg)

    snapshot = await adapter.read_snapshot()
    assert "grid-meter-01" in snapshot.assets
    meter_snap = snapshot.assets["grid-meter-01"]
    assert meter_snap.status == "online"
    assert meter_snap.measurements["active_power_kw"].value == pytest.approx(85.2)
    assert meter_snap.measurements["voltage_v"].value == pytest.approx(415.0)

    # Test command write
    now = datetime.now(timezone.utc)
    cmd = ControlCommand(
        id="cmd-mqtt-1",
        idempotency_key="idemp-mqtt-1",
        target_asset_id="grid-meter-01",
        action="set_import_limit",
        requested_setpoint=100.0,
        unit="kW",
        valid_from=now,
        valid_until=now + timedelta(minutes=60),
        reason="Demand limit enforcement",
        originating_actor="system:reliability",
    )

    res = await adapter.write_command(cmd)
    assert res.status == CommandStatus.ACCEPTED
    await adapter.stop()


@pytest.mark.asyncio
async def test_in_memory_test_adapter():
    adapter = InMemoryTestAdapter(site_id=1, adapter_id="stub_01")
    await adapter.start()

    health = await adapter.health()
    assert health.is_healthy is True

    now = datetime.now(timezone.utc)
    cmd = ControlCommand(
        id="cmd-stub-1",
        idempotency_key="idemp-stub-1",
        target_asset_id="test-asset",
        action="noop",
        requested_setpoint=0.0,
        unit="kW",
        valid_from=now,
        valid_until=now + timedelta(minutes=10),
        reason="Testing stub",
        originating_actor="test:runner",
    )

    res = await adapter.write_command(cmd)
    assert res.status == CommandStatus.ACCEPTED
    assert len(adapter.received_commands) == 1

    # Test command rejection mode
    adapter.reject_all_commands = True
    res_rejected = await adapter.write_command(cmd)
    assert res_rejected.status == CommandStatus.REJECTED
    assert res_rejected.diagnostic_code == "TEST_REJECT"

    await adapter.stop()
