import React from 'react';
import { AssetRead, CriticalityTier } from '../types';
import { QualityBadge } from './StatusBadge';
import { Building2, Shield } from 'lucide-react';

interface BuildingCardProps {
  asset: AssetRead;
  onClick?: () => void;
}

export const BuildingCard: React.FC<BuildingCardProps> = ({ asset, onClick }) => {
  const cfg = asset.building_config;
  const state = asset.state;
  const activePower = state?.active_power_kw ?? 0;
  const peakLoad = cfg?.peak_load_kw ?? asset.rated_capacity_kw;
  const utilization = peakLoad > 0 ? Math.min(100, Math.max(0, (activePower / peakLoad) * 100)) : 0;
  const tier = cfg?.criticality_tier || 'essential';

  const tierStyles: Record<CriticalityTier, { bg: string; text: string; label: string }> = {
    critical: {
      bg: 'bg-rose-500/20 border-rose-500/40',
      text: 'text-rose-300',
      label: 'Critical (Tier 1)',
    },
    essential: {
      bg: 'bg-amber-500/20 border-amber-500/40',
      text: 'text-amber-300',
      label: 'Essential (Tier 2)',
    },
    non_critical: {
      bg: 'bg-slate-700/40 border-slate-600',
      text: 'text-slate-300',
      label: 'Non-Critical (Tier 3)',
    },
  };

  const currentTier = tierStyles[tier as CriticalityTier] || tierStyles.essential;

  return (
    <div
      onClick={onClick}
      className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900 cursor-pointer"
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{cfg?.building_name || asset.name}</h3>
              <div className="text-[11px] text-slate-400 font-mono">{asset.id}</div>
            </div>
          </div>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${currentTier.bg} ${currentTier.text}`}>
            {currentTier.label}
          </span>
        </div>

        {/* Live Power Metrics */}
        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Current Demand</div>
            <div className="text-xl font-bold text-white mt-0.5">
              {activePower.toFixed(1)} <span className="text-xs font-normal text-slate-400">kW</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Peak Capacity</div>
            <div className="text-sm font-semibold text-slate-300 mt-0.5">
              {peakLoad.toFixed(1)} <span className="text-xs text-slate-500">kW</span>
            </div>
          </div>
        </div>

        {/* Load Utilization Gauge */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span>Capacity Utilization</span>
            <span>{utilization.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                utilization > 85
                  ? 'bg-rose-500'
                  : utilization > 60
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${utilization}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-1 text-slate-400">
          <Shield className="h-3 w-3 text-slate-500" />
          <span>Policy: <b className="text-slate-300 capitalize">{cfg?.flexible_load_policy || 'Protected'}</b></span>
        </div>
        <QualityBadge quality={state?.telemetry_quality || 'good'} size="sm" />
      </div>
    </div>
  );
};
