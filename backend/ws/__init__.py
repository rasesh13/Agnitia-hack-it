from backend.ws.websocket_manager import WebSocketEnvelope, WebSocketManager

# Global singleton WebSocketManager instance
ws_manager = WebSocketManager()

__all__ = ["WebSocketManager", "WebSocketEnvelope", "ws_manager"]
