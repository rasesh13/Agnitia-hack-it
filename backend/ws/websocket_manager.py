import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Set

from fastapi import WebSocket, status
from pydantic import BaseModel, ConfigDict, Field

from backend.models.base import utc_now
from backend.services.auth_crypto import decode_access_token

logger = logging.getLogger("surya.websocket")


class WebSocketEnvelope(BaseModel):
    """
    Versioned WebSocket message envelope conforming to SURYA spec Section 14.
    """

    model_config = ConfigDict(extra="forbid")

    version: int = Field(1, description="Envelope schema version")
    type: str = Field(
        ...,
        description="Event type: twin_update, full_cycle, alert, health, error",
    )
    message_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique event message UUID",
    )
    sent_at: datetime = Field(
        default_factory=utc_now,
        description="Event dispatch UTC timestamp",
    )
    request_id: Optional[str] = Field(
        None, description="Optional correlating request ID"
    )
    data: Dict[str, Any] = Field(
        default_factory=dict, description="Event payload dictionary"
    )


class WebSocketManager:
    """
    Manages authenticated WebSocket connections, live state broadcasting,
    dead connection cleanup, and non-blocking event dispatch.
    Conforms to SURYA spec Section 14.
    """

    def __init__(self) -> None:
        self._active_connections: Dict[WebSocket, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    @property
    def connection_count(self) -> int:
        """Returns the number of currently active authenticated WebSocket clients."""
        return len(self._active_connections)

    async def authenticate_and_connect(
        self,
        websocket: WebSocket,
        token: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Validates JWT token, accepts WebSocket connection if valid, or closes with 4001.
        """
        try:
            payload = decode_access_token(token)
            if not payload or not payload.sub:
                logger.warning("WebSocket connection rejected: Invalid or expired token")
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return None
        except Exception as err:
            logger.warning("WebSocket connection rejected: %s", err)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None

        await websocket.accept()
        role_val = payload.role.value if hasattr(payload.role, "value") else str(payload.role)
        user_info = {
            "user_id": payload.sub,
            "role": role_val,
            "email": payload.email,
            "connected_at": utc_now(),
        }

        async with self._lock:
            self._active_connections[websocket] = user_info

        logger.info(
            "WebSocket client connected: user_id=%s, role=%s (total active: %d)",
            user_info["user_id"],
            user_info["role"],
            self.connection_count,
        )
        return user_info

    async def disconnect(self, websocket: WebSocket) -> None:
        """Removes a client from active connection tracking."""
        async with self._lock:
            user_info = self._active_connections.pop(websocket, None)

        if user_info:
            logger.info(
                "WebSocket client disconnected: user_id=%s (total active: %d)",
                user_info.get("user_id"),
                self.connection_count,
            )

    async def send_personal_message(
        self,
        websocket: WebSocket,
        event_type: str,
        data: Dict[str, Any],
        request_id: Optional[str] = None,
    ) -> bool:
        """Sends a structured versioned envelope to a single WebSocket client."""
        envelope = WebSocketEnvelope(
            version=1,
            type=event_type,
            sent_at=utc_now(),
            request_id=request_id,
            data=data,
        )
        try:
            # Custom encoder serializer for datetimes
            text = envelope.model_dump_json()
            await websocket.send_text(text)
            return True
        except Exception as exc:
            logger.warning("Failed to send message to client: %s", exc)
            await self.disconnect(websocket)
            return False

    async def broadcast(
        self,
        event_type: str,
        data: Dict[str, Any],
        request_id: Optional[str] = None,
    ) -> int:
        """
        Broadcasts a versioned envelope to all active authenticated clients non-blockingly.
        Cleans up dead connections automatically without blocking the publisher loop.
        """
        if not self._active_connections:
            return 0

        envelope = WebSocketEnvelope(
            version=1,
            type=event_type,
            sent_at=utc_now(),
            request_id=request_id,
            data=data,
        )
        message_json = envelope.model_dump_json()

        async with self._lock:
            clients = list(self._active_connections.keys())

        dead_clients: Set[WebSocket] = set()

        async def _send(ws: WebSocket):
            try:
                await ws.send_text(message_json)
            except Exception:
                dead_clients.add(ws)

        # Non-blocking parallel broadcast across all connected clients
        await asyncio.gather(*[_send(ws) for ws in clients], return_exceptions=True)

        if dead_clients:
            async with self._lock:
                for dead in dead_clients:
                    self._active_connections.pop(dead, None)
            logger.info(
                "Cleaned up %d dead WebSocket connections (remaining: %d)",
                len(dead_clients),
                self.connection_count,
            )

        return len(clients) - len(dead_clients)
