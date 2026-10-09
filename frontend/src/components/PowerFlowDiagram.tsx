import React from 'react';
import { Sun, Wind, BatteryCharging, Building2, UtilityPole, ArrowRight, ArrowLeft } from 'lucide-react';

interface PowerFlowProps {
  solarKw: number;
  windKw: number;
  demandKw: number;
  batteryKw: number; // positive = discharge, negative = charge
  batterySoc: number;
  netGridKw: number; // positive = import, negative = export
}

export const PowerFlowDiagram: React.FC<PowerFlowProps> = ({
  solarKw,
  windKw,
  demandKw,
  batteryKw,
  batterySoc,
  netGridKw,
}) => {
  const totalRenewables = solarKw + windKw;
  const isBatteryCharging = batteryKw < 0;
  const isBatteryDischarging = batteryKw > 0;
  const isGridImporting = netGridKw > 0;
  const isGridExporting = netGridKw < 0;

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Where the power is flowing</h2>
          <p className="text-sm text-slate-300">Live power from generation and storage to the campus</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-400">Synchronized</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Left Column: Generation Sources */}
        <div className="flex flex-col gap-4">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-300">Generation</div>

          {/* Solar Array Node */}
          <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 transition-all hover:border-amber-500/40">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Sun className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-semibold text-white">Rooftop Solar Array</div>
                <div className="text-[11px] text-amber-400/80">Rooftops and canopies</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-amber-300">{solarKw.toFixed(1)} kW</div>
              <div className="text-[10px] text-slate-400">Generating</div>
            </div>
          </div>

          {/* Wind Turbine Node */}
          <div className="flex items-center justify-between rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4 transition-all hover:border-cyan-500/40">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Wind className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-semibold text-white">Wind Turbines</div>
                <div className="text-[11px] text-cyan-400/80">Campus perimeter</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-cyan-300">{windKw.toFixed(1)} kW</div>
              <div className="text-[10px] text-slate-400">Generating</div>
            </div>
          </div>
        </div>

        {/* Middle Column: Central Microgrid Bus & Battery Storage */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Campus Microgrid
            </span>
            <div className="mt-2 flex items-baseline justify-center gap-1.5">
              <span className="text-5xl font-black text-white">{totalRenewables.toFixed(1)}</span>
              <span className="text-xs font-semibold text-slate-400">kW from solar + wind</span>
            </div>
          </div>

          {/* Battery Flow Unit */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BatteryCharging className="h-5 w-5 text-purple-400" />
                <span className="text-base font-bold text-purple-200">Battery</span>
              </div>
              <span className="text-base font-bold text-purple-300">{batterySoc.toFixed(0)}% full</span>
            </div>

            {/* SoC Progress Bar */}
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, batterySoc))}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-400">Flow</span>
              <span className="flex items-center gap-1 font-bold text-purple-200">
                {isBatteryCharging && <ArrowLeft className="h-3.5 w-3.5 text-purple-400 animate-pulse" />}
                {isBatteryDischarging && <ArrowRight className="h-3.5 w-3.5 text-purple-400 animate-pulse" />}
                {Math.abs(batteryKw).toFixed(1)} kW {isBatteryCharging ? '(Charging)' : isBatteryDischarging ? '(Discharging)' : '(Idle)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Demand & Grid Interconnection */}
        <div className="flex flex-col gap-4">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-300">Demand & Grid</div>

          {/* Campus Demand Node */}
          <div className="flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 transition-all hover:border-rose-500/40">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-semibold text-white">Campus Buildings</div>
                <div className="text-[11px] text-rose-400/80">All buildings</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-rose-300">{demandKw.toFixed(1)} kW</div>
              <div className="text-[10px] text-slate-400">Using</div>
            </div>
          </div>

          {/* Grid Interconnection Node */}
          <div className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-950/20 p-4 transition-all hover:border-blue-500/40">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <UtilityPole className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-semibold text-white">Utility Grid</div>
                <div className="text-[11px] text-blue-400/80">Main connection</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-blue-300">
                {Math.abs(netGridKw).toFixed(1)} kW
              </div>
              <div className="text-[10px] font-medium text-slate-400">
                {isGridImporting ? 'Importing from Grid' : isGridExporting ? 'Exporting to Grid' : 'Zero Net Flow'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
