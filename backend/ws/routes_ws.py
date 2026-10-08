import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from backend.ws import ws_manager

logger = logging.getLogger("surya.ws_router")

router = APIRouter(tags=["WebSocket Real-Time"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="Bearer JWT access token"),
) -> None:
    """
    Real-time WebSocket endpoint delivering live twin updates, decision cycles,
    alerts, and health metrics. Requires valid JWT access token query parameter.
    """
    user_info = await ws_manager.authenticate_and_connect(websocket, token=token)
    if user_info is None:
        return

    try:
        while True:
            # Client heartbeats / messages
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("WebSocket client error: %s", exc)
        await ws_manager.disconnect(websocket)
