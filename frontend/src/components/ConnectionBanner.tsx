import React from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { AlertTriangle, WifiOff, RefreshCw, Clock } from 'lucide-react';

export const ConnectionBanner: React.FC = () => {
  const { connectionStatus, isStale, stalenessSeconds, reconnect } = useWebSocket();

  if (connectionStatus === 'connected' && !isStale) {
    return null;
  }

  if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
    return (
      <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-950/60 px-4 py-2 text-xs font-medium text-amber-200">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
          <span>Connecting to real-time WebSocket telemetry stream...</span>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
    return (
      <div className="flex items-center justify-between border-b border-red-500/40 bg-red-950/70 px-4 py-2 text-xs font-medium text-red-200">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span>
            <b>Live Stream Disconnected:</b> Real-time updates paused. Fail-safe hold active.
          </span>
        </div>
        <button
          onClick={reconnect}
          className="flex items-center gap-1 rounded bg-red-800/80 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Reconnect Now</span>
        </button>
      </div>
    );
  }

  if (isStale) {
    return (
      <div className="flex items-center justify-between border-b border-orange-500/30 bg-orange-950/60 px-4 py-2 text-xs font-medium text-orange-200">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-400 flex-shrink-0 animate-pulse" />
          <span>
            <b>Telemetry Stale ({stalenessSeconds}s elapsed):</b> No measurement packet received recently. Conservative battery & dispatch floors engaged.
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-orange-300/80 text-[11px]">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
          <span>Adapter degraded</span>
        </div>
      </div>
    );
  }

  return null;
};
