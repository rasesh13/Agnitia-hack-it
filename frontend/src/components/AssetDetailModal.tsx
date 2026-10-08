import React, { useState, useEffect } from 'react';
import { AssetRead, TelemetryPoint } from '../types';
import { QualityBadge, OperationalStatusBadge } from './StatusBadge';
import { apiTwin } from '../services/api';
import {
  X,
  Cpu,
  Activity,
  Zap,
  Gauge,
  Thermometer,
  Battery,
  Shield,
  Clock,
  Database,
  Loader2,
} from 'lucide-react';

interface AssetDetailModalProps {
  asset: AssetRead | null;
  onClose: () => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ asset, onClose }) => {
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!asset) return;

    let isMounted = true;
    async function loadTelemetry() {
      if (!asset) return;
      setIsLoading(true);
      try {
        const points = await apiTwin.getAssetTelemetry(asset.id, undefined, undefined, undefined, 25);
        if (isMounted) setTelemetry(points);
      } catch {
        // Telemetry fetch fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadTelemetry();
    return () => {
      isMounted = false;
    };
  }, [asset]);

  if (!asset) return null;

  const state = asset.state;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">{asset.name}</h2>
                <OperationalStatusBadge status={state?.operational_status || 'online'} />
                <QualityBadge quality={state?.telemetry_quality || 'good'} />
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                Asset ID: {asset.id} • Type: <span className="capitalize text-slate-300">{asset.asset_type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Physical Measurements */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Live Physical Measurements
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Active Power</span>
                </div>
                <div className="text-lg font-bold text-white mt-1">
                  {state?.active_power_kw !== undefined ? `${state.active_power_kw.toFixed(1)} kW` : '—'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Gauge className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Rated Capacity</span>
                </div>
                <div className="text-lg font-bold text-white mt-1">
                  {asset.rated_capacity_kw.toFixed(1)} kW
                </div>
              </div>

              {state?.voltage_v !== null && state?.voltage_v !== undefined && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Activity className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Voltage</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1">{state.voltage_v.toFixed(1)} V</div>
                </div>
              )}

              {state?.temperature_celsius !== null && state?.temperature_celsius !== undefined && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Thermometer className="h-3.5 w-3.5 text-rose-400" />
                    <span>Temperature</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1">{state.temperature_celsius.toFixed(1)} °C</div>
                </div>
              )}

              {state?.soc_percent !== null && state?.soc_percent !== undefined && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Battery className="h-3.5 w-3.5 text-purple-400" />
                    <span>State of Charge</span>
                  </div>
                  <div className="text-lg font-bold text-purple-300 mt-1">{state.soc_percent.toFixed(0)}%</div>
                </div>
              )}

              {state?.health_percent !== null && state?.health_percent !== undefined && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Health (SOH)</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-300 mt-1">{state.health_percent.toFixed(0)}%</div>
                </div>
              )}
            </div>
          </div>

          {/* Configuration Parameters */}
          {asset.battery_config && (
            <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">
                Battery Operating Boundaries & Reserves
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-slate-400">Min/Max SoC:</span>
                  <span className="ml-1 font-semibold text-slate-200">
                    {asset.battery_config.min_soc}% – {asset.battery_config.max_soc}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Reserve Floor:</span>
                  <span className="ml-1 font-semibold text-purple-300">{asset.battery_config.reserve_floor}%</span>
                </div>
                <div>
                  <span className="text-slate-400">Max C/D Rate:</span>
                  <span className="ml-1 font-semibold text-slate-200">{asset.battery_config.max_charge_power_kw} kW</span>
                </div>
                <div>
                  <span className="text-slate-400">Roundtrip Eff:</span>
                  <span className="ml-1 font-semibold text-slate-200">
                    {(asset.battery_config.round_trip_efficiency * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Historical Telemetry Stream */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent Ingested Telemetry Points
              </h3>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <Clock className="h-3 w-3" />
                <span>Last Observed: {state?.observed_at ? new Date(state.observed_at).toLocaleTimeString() : 'N/A'}</span>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading telemetry history...</span>
              </div>
            ) : telemetry.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Timestamp (Local)</th>
                      <th className="px-3 py-2">Metric</th>
                      <th className="px-3 py-2">Value</th>
                      <th className="px-3 py-2">Quality</th>
                      <th className="px-3 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {telemetry.slice(0, 10).map((pt) => (
                      <tr key={pt.id} className="hover:bg-slate-900/50">
                        <td className="px-3 py-2 text-slate-300">{new Date(pt.observed_at).toLocaleTimeString()}</td>
                        <td className="px-3 py-2 text-slate-200">{pt.metric_name}</td>
                        <td className="px-3 py-2 font-bold text-white">
                          {pt.value.toFixed(1)} {pt.unit}
                        </td>
                        <td className="px-3 py-2">
                          <QualityBadge quality={pt.quality} size="sm" />
                        </td>
                        <td className="px-3 py-2 text-slate-400">{pt.source_adapter || 'system'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 border border-slate-800/80 rounded-xl">
                No recent telemetry points recorded in this buffer.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3 bg-slate-950/60 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-slate-500" />
            <span>Digital Twin In-Memory State Synchronized</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
