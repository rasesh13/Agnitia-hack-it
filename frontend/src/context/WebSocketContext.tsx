import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { AlertSeverity, DecisionCycle, SiteRead, WebSocketEnvelope } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface AlertNotification {
  id: string;
  message: string;
  severity: AlertSeverity;
  metric_name?: string;
  timestamp: string;
}

interface WebSocketContextType {
  connectionStatus: ConnectionStatus;
  lastMessageAt: Date | null;
  isStale: boolean;
  stalenessSeconds: number;
  twinData: SiteRead | null;
  latestCycle: DecisionCycle | null;
  activeAlerts: AlertNotification[];
  liveFluctuation?: any;
  reconnect: () => void;
  sendMessage: (msg: string) => void;
  dismissAlert: (id: string) => void;
  updateTwinState: (data: SiteRead) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const STALENESS_THRESHOLD_SECONDS = 30;

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessageAt, setLastMessageAt] = useState<Date | null>(null);
  const [stalenessSeconds, setStalenessSeconds] = useState<number>(0);
  const [twinData, setTwinData] = useState<SiteRead | null>(null);
  const [latestCycle, setLatestCycle] = useState<DecisionCycle | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AlertNotification[]>([]);
  const [liveFluctuation, setLiveFluctuation] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  const isManuallyClosedRef = useRef<boolean>(false);

  const updateTwinState = useCallback((data: SiteRead) => {
    setTwinData(data);
    setLastMessageAt(new Date());
    setStalenessSeconds(0);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) {
      setConnectionStatus('disconnected');
      return;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    isManuallyClosedRef.current = false;
    setConnectionStatus(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');

    // When the API lives on another origin (e.g. Render), connect the socket there too.
    const apiBase = import.meta.env.VITE_API_URL as string | undefined;
    const socketBase = apiBase
      ? apiBase.replace(/^http/, 'ws').replace(/\/+$/, '')
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const wsUrl = `${socketBase}/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        retryCountRef.current = 0;
        setLastMessageAt(new Date());

        // Setup ping heartbeat every 15 seconds
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        setLastMessageAt(new Date());
        setStalenessSeconds(0);

        if (event.data === 'pong') {
          return;
        }

        try {
          const envelope: WebSocketEnvelope = JSON.parse(event.data);
          if (envelope.type === 'twin_update') {
            const incoming = envelope.data as any;
            if (incoming?.fluctuation) {
              setLiveFluctuation(incoming.fluctuation);
            }
            const rawAgg = incoming?.aggregates || incoming?.aggregate;
            const normalizedAgg = rawAgg
              ? {
                  total_solar_generation_kw: Number(rawAgg.total_solar_generation_kw ?? rawAgg.total_solar_kw ?? 0),
                  total_wind_generation_kw: Number(rawAgg.total_wind_generation_kw ?? rawAgg.total_wind_kw ?? 0),
                  total_renewable_generation_kw: Number(
                    rawAgg.total_renewable_generation_kw ??
                      rawAgg.total_generation_kw ??
                      ((rawAgg.total_solar_kw || 0) + (rawAgg.total_wind_kw || 0))
                  ),
                  total_campus_demand_kw: Number(rawAgg.total_campus_demand_kw ?? rawAgg.total_building_demand_kw ?? 0),
                  total_battery_power_kw: Number(rawAgg.total_battery_power_kw ?? rawAgg.net_battery_kw ?? 0),
                  net_grid_exchange_kw: Number(rawAgg.net_grid_exchange_kw ?? rawAgg.net_grid_flow_kw ?? 0),
                  average_battery_soc_percent: Number(rawAgg.average_battery_soc_percent ?? 75),
                  data_freshness_status: rawAgg.data_freshness_status ?? rawAgg.overall_quality ?? 'live',
                }
              : undefined;

            setTwinData((prev) => {
              if (!prev) return { ...incoming, aggregates: normalizedAgg } as SiteRead;
              return {
                ...prev,
                ...incoming,
                aggregates: normalizedAgg || prev.aggregates,
                assets: incoming.assets || prev.assets,
              };
            });
          } else if (envelope.type === 'full_cycle') {
            setLatestCycle(envelope.data as DecisionCycle);
          } else if (envelope.type === 'alert') {
            const alertPayload = envelope.data as AlertNotification;
            setActiveAlerts((prev) => [
              {
                id: alertPayload.id || `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                message: alertPayload.message || 'Operational alert detected',
                severity: alertPayload.severity || 'warning',
                metric_name: alertPayload.metric_name,
                timestamp: alertPayload.timestamp || new Date().toISOString(),
              },
              ...prev.slice(0, 49),
            ]);
          }
        } catch {
          // Ignore non-JSON socket packets
        }
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (isManuallyClosedRef.current) {
          setConnectionStatus('disconnected');
          return;
        }

        setConnectionStatus('disconnected');

        // Exponential backoff reconnect with jitter (1s, 2s, 4s, 8s, 16s, max 30s)
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current) + Math.random() * 500, 30000);
        retryCountRef.current += 1;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        setConnectionStatus('error');
      };
    } catch {
      setConnectionStatus('error');
    }
  }, [isAuthenticated, token]);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    retryCountRef.current = 0;
    connect();
  }, [disconnect, connect]);

  const sendMessage = useCallback((msg: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(msg);
    }
  }, []);

  // Monitor staleness timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastMessageAt) {
        const elapsed = Math.floor((Date.now() - lastMessageAt.getTime()) / 1000);
        setStalenessSeconds(elapsed);
      } else {
        setStalenessSeconds(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastMessageAt]);

  // Connect on authentication, disconnect on logout
  useEffect(() => {
    if (isAuthenticated && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, token, connect, disconnect]);

  const isStale = stalenessSeconds >= STALENESS_THRESHOLD_SECONDS;

  return (
    <WebSocketContext.Provider
      value={{
        connectionStatus,
        lastMessageAt,
        isStale,
        stalenessSeconds,
        twinData,
        latestCycle,
        activeAlerts,
        liveFluctuation,
        reconnect,
        sendMessage,
        dismissAlert,
        updateTwinState,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
