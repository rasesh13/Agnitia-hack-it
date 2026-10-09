import React from 'react';
import { BatteryCharging, ShieldAlert } from 'lucide-react';

interface BatteryGaugeProps {
  socPercent: number;
  reserveFloor?: number;
  minSoc?: number;
  maxSoc?: number;
  powerKw: number; // positive = discharge, negative = charge
  healthPercent?: number;
  temperatureCelsius?: number;
}

export const BatteryGauge: React.FC<BatteryGaugeProps> = ({
  socPercent,
  reserveFloor = 20,
  minSoc = 10,
  maxSoc = 95,
  powerKw,
  healthPercent = 98,
  temperatureCelsius,
}) => {
  const safeSoc = Math.min(100, Math.max(0, socPercent));
  const isCharging = powerKw < 0;
  const isDischarging = powerKw > 0;
  const isBelowReserve = safeSoc <= reserveFloor;

  const getSocColor = () => {
    if (safeSoc <= minSoc) return 'from-rose-600 to-red-500';
    if (safeSoc <= reserveFloor) return 'from-amber-600 to-orange-500';
    if (safeSoc <= 50) return 'from-yellow-500 to-emerald-500';
    return 'from-emerald-500 to-teal-400';
  };

  return (
    <div className="flex flex-col items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex w-full items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <BatteryCharging className="h-5 w-5 text-purple-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">State of Charge (SoC)</span>
        </div>
        {isBelowReserve && (
          <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
            <ShieldAlert className="h-3 w-3 text-amber-400" />
            <span>Below Reserve Floor</span>
          </span>
        )}
      </div>

      {/* Main SoC Visual Gauge */}
      <div className="relative my-6 flex h-48 w-48 items-center justify-center">
        {/* Background Circle */}
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="transparent"
            stroke="#e9dfcc"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="10"
            strokeDasharray={263.89}
            strokeDashoffset={263.89 - (263.89 * safeSoc) / 100}
            strokeLinecap="round"
            className={`transition-all duration-700 ${
              safeSoc <= reserveFloor ? 'text-amber-500' : 'text-emerald-500'
            }`}
          />
        </svg>

        {/* Center Numbers */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-black tracking-tight text-white">{safeSoc.toFixed(0)}%</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
            {isCharging
              ? 'Charging'
              : isDischarging
              ? 'Discharging'
              : 'Standby'}
          </span>
          <span className="text-xs font-mono font-bold text-purple-300 mt-1">
            {Math.abs(powerKw).toFixed(1)} kW
          </span>
        </div>
      </div>

      {/* Limits & Reserve Progress Bar */}
      <div className="w-full space-y-3">
        <div className="relative pt-2">
          {/* Reserve marker indicator */}
          <div
            className="absolute top-0 flex flex-col items-center text-[9px] font-bold text-amber-400 -translate-x-1/2"
            style={{ left: `${reserveFloor}%` }}
          >
            <span>▲</span>
            <span className="whitespace-nowrap -mt-1">Reserve ({reserveFloor}%)</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${getSocColor()} transition-all duration-500`}
              style={{ width: `${safeSoc}%` }}
            />
          </div>
        </div>

        {/* Operating Limits Grid */}
        <div className="grid grid-cols-4 gap-2 border-t border-slate-800/80 pt-3 text-center text-xs">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Min SoC</div>
            <div className="font-semibold text-slate-300">{minSoc}%</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Max SoC</div>
            <div className="font-semibold text-slate-300">{maxSoc}%</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Health (SOH)</div>
            <div className="font-semibold text-emerald-400">{healthPercent}%</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Temperature</div>
            <div className="font-semibold text-slate-300">
              {temperatureCelsius !== undefined ? `${temperatureCelsius.toFixed(1)} °C` : '28.5 °C'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
