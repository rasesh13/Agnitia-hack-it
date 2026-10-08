import { useEffect, useState, useCallback, useMemo } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { apiTwin } from '../services/api';
import { AssetRead, SiteRead } from '../types';

export function useLiveTwin(siteId: number = 1) {
  const { twinData, isStale, stalenessSeconds, connectionStatus, updateTwinState } = useWebSocket();
  const [initialSite, setInitialSite] = useState<SiteRead | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSite = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiTwin.getSiteTwin(siteId);
      setInitialSite(data);
      updateTwinState(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load digital twin state';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [siteId, updateTwinState]);

  useEffect(() => {
    fetchSite();
  }, [fetchSite]);

  // Current active site data is live WebSocket data if available, else initial fetch
  const site = twinData || initialSite;

  const assets: AssetRead[] = useMemo(() => {
    return site?.assets || [];
  }, [site]);

  // Compute live aggregates if not explicitly supplied by API
  const aggregates = useMemo(() => {
    if (site?.aggregates) {
      return site.aggregates;
    }

    let solarKw = 0;
    let windKw = 0;
    let demandKw = 0;
    let batteryKw = 0;
    let totalSoc = 0;
    let batteryCount = 0;

    assets.forEach((asset) => {
      const p = asset.state?.active_power_kw || 0;
      if (asset.asset_type === 'solar') {
        solarKw += p;
      } else if (asset.asset_type === 'wind') {
        windKw += p;
      } else if (asset.asset_type === 'building') {
        demandKw += p;
      } else if (asset.asset_type === 'battery') {
        batteryKw += p;
        if (asset.state?.soc_percent !== null && asset.state?.soc_percent !== undefined) {
          totalSoc += asset.state.soc_percent;
          batteryCount += 1;
        }
      }
    });

    const renewableKw = solarKw + windKw;
    // Campus balance: Net Grid = Demand - (Renewable + Battery Discharge)
    const netGridKw = demandKw - (renewableKw + batteryKw);
    const avgSoc = batteryCount > 0 ? totalSoc / batteryCount : 0;

    return {
      total_solar_generation_kw: Math.max(0, solarKw),
      total_wind_generation_kw: Math.max(0, windKw),
      total_renewable_generation_kw: Math.max(0, renewableKw),
      total_campus_demand_kw: Math.max(0, demandKw),
      total_battery_power_kw: batteryKw,
      net_grid_exchange_kw: netGridKw,
      average_battery_soc_percent: Math.min(100, Math.max(0, avgSoc)),
      data_freshness_status: isStale ? 'stale' : 'live',
    };
  }, [site, assets, isStale]);

  return {
    site,
    assets,
    aggregates,
    isLoading,
    error,
    isStale,
    stalenessSeconds,
    connectionStatus,
    refresh: fetchSite,
  };
}
