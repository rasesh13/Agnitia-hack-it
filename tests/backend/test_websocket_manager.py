import json
from unittest.mock import AsyncMock

import pytest

from backend.models.user import UserRole
from backend.services.auth_crypto import create_access_token
from backend.ws.websocket_manager import WebSocketEnvelope, WebSocketManager


@pytest.fixture
def ws_manager() -> WebSocketManager:
    return WebSocketManager()


@pytest.fixture
def valid_token() -> str:
    return create_access_token(
        user_id=123,
        email="operator@surya.local",
        role=UserRole.OPERATOR,
    )


def test_websocket_envelope_schema():
    envelope = WebSocketEnvelope(
        version=1,
        type="twin_update",
        data={"campus_solar_kw": 120.0},
    )
    assert envelope.version == 1
    assert envelope.type == "twin_update"
    assert envelope.message_id is not None
    assert envelope.sent_at is not None
    assert envelope.data["campus_solar_kw"] == 120.0

    # JSON serialization check
    json_str = envelope.model_dump_json()
    parsed = json.loads(json_str)
    assert parsed["version"] == 1
    assert parsed["type"] == "twin_update"
    assert parsed["data"]["campus_solar_kw"] == 120.0


@pytest.mark.asyncio
async def test_authenticate_and_connect_success(
    ws_manager: WebSocketManager, valid_token: str
):
    mock_ws = AsyncMock()
    mock_ws.accept = AsyncMock()

    user_info = await ws_manager.authenticate_and_connect(mock_ws, token=valid_token)
    assert user_info is not None
    assert user_info["user_id"] == "123"
    assert user_info["role"] == "operator"
    assert ws_manager.connection_count == 1
    mock_ws.accept.assert_called_once()


@pytest.mark.asyncio
async def test_authenticate_and_connect_invalid_token(ws_manager: WebSocketManager):
    mock_ws = AsyncMock()
    mock_ws.close = AsyncMock()

    # Missing token
    res_none = await ws_manager.authenticate_and_connect(mock_ws, token=None)
    assert res_none is None
    mock_ws.close.assert_called_with(code=1008)

    # Invalid token string
    mock_ws.reset_mock()
    res_invalid = await ws_manager.authenticate_and_connect(mock_ws, token="invalid_jwt_token")
    assert res_invalid is None
    mock_ws.close.assert_called_with(code=1008)
    assert ws_manager.connection_count == 0


@pytest.mark.asyncio
async def test_send_personal_message(
    ws_manager: WebSocketManager, valid_token: str
):
    mock_ws = AsyncMock()
    mock_ws.accept = AsyncMock()
    mock_ws.send_text = AsyncMock()

    await ws_manager.authenticate_and_connect(mock_ws, token=valid_token)

    success = await ws_manager.send_personal_message(
        websocket=mock_ws,
        event_type="alert",
        data={"severity": "warning", "message": "High grid demand"},
        request_id="req-123",
    )

    assert success is True
    mock_ws.send_text.assert_called_once()
    sent_text = mock_ws.send_text.call_args[0][0]
    envelope = json.loads(sent_text)
    assert envelope["version"] == 1
    assert envelope["type"] == "alert"
    assert envelope["request_id"] == "req-123"
    assert envelope["data"]["severity"] == "warning"


@pytest.mark.asyncio
async def test_broadcast_to_multiple_clients(
    ws_manager: WebSocketManager, valid_token: str
):
    ws1, ws2, ws3 = AsyncMock(), AsyncMock(), AsyncMock()
    for ws in (ws1, ws2, ws3):
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        await ws_manager.authenticate_and_connect(ws, token=valid_token)

    assert ws_manager.connection_count == 3

    delivered = await ws_manager.broadcast(
        event_type="full_cycle",
        data={"cycle_id": "cycle-001", "status": "completed"},
    )

    assert delivered == 3
    for ws in (ws1, ws2, ws3):
        ws.send_text.assert_called_once()
        msg = json.loads(ws.send_text.call_args[0][0])
        assert msg["type"] == "full_cycle"
        assert msg["data"]["cycle_id"] == "cycle-001"


@pytest.mark.asyncio
async def test_broadcast_cleans_up_dead_clients(
    ws_manager: WebSocketManager, valid_token: str
):
    live_ws = AsyncMock()
    live_ws.accept = AsyncMock()
    live_ws.send_text = AsyncMock()

    dead_ws = AsyncMock()
    dead_ws.accept = AsyncMock()
    dead_ws.send_text = AsyncMock(side_effect=RuntimeError("Client connection dropped"))

    await ws_manager.authenticate_and_connect(live_ws, token=valid_token)
    await ws_manager.authenticate_and_connect(dead_ws, token=valid_token)
    assert ws_manager.connection_count == 2

    delivered = await ws_manager.broadcast(
        event_type="twin_update",
        data={"online_assets": 5},
    )

    # Only 1 delivered, dead client removed
    assert delivered == 1
    assert ws_manager.connection_count == 1
    assert live_ws in ws_manager._active_connections
    assert dead_ws not in ws_manager._active_connections
