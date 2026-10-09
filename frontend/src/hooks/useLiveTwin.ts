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
    const raw = site?.aggregates || (site as any)?.aggregate;
    if (raw) {
      const solar = Number(raw.total_solar_generation_kw ?? raw.total_solar_kw ?? 0);
      const wind = Number(raw.total_wind_generation_kw ?? raw.total_wind_kw ?? 0);
      const renewable = Number(
        raw.total_renewable_generation_kw ??
          raw.total_generation_kw ??
          (solar + wind)
      );
      const demand = Number(raw.total_campus_demand_kw ?? raw.total_building_demand_kw ?? 0);
      const battery = Number(raw.total_battery_power_kw ?? raw.net_battery_kw ?? 0);
      const grid = Number(raw.net_grid_exchange_kw ?? raw.net_grid_flow_kw ?? 0);
      const soc = Number(raw.average_battery_soc_percent ?? 75);
      const freshness = raw.data_freshness_status ?? raw.overall_quality ?? (isStale ? 'stale' : 'live');

      return {
        total_solar_generation_kw: isNaN(solar) ? 0 : solar,
        total_wind_generation_kw: isNaN(wind) ? 0 : wind,
        total_renewable_generation_kw: isNaN(renewable) ? 0 : renewable,
        total_campus_demand_kw: isNaN(demand) ? 0 : demand,
        total_battery_power_kw: isNaN(battery) ? 0 : battery,
        net_grid_exchange_kw: isNaN(grid) ? 0 : grid,
        average_battery_soc_percent: isNaN(soc) ? 75 : Math.min(100, Math.max(0, soc)),
        data_freshness_status: freshness,
      };
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
