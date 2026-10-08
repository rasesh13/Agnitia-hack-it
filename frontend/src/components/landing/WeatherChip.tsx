import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CloudSun, Wind, Droplets, SunMedium } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WeatherChipProps {
  className?: string;
  temperature?: number;
  cloudCover?: number;
  windSpeedKmh?: number;
  humidity?: number;
  location?: string;
}

export const WeatherChip: React.FC<WeatherChipProps> = ({
  className,
  temperature = 33.4,
  cloudCover = 14,
  windSpeedKmh = 16.2,
  humidity = 36,
  location = 'Rajasthan DTE • Site 01',
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{
        opacity: 1,
        y: shouldReduceMotion ? 0 : [0, -6, 0],
      }}
      transition={{
        opacity: { duration: 0.6, ease: 'easeOut' },
        y: {
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/15 bg-slate-900/60 p-4 shadow-xl shadow-black/40 backdrop-blur-md transition-all hover:border-amber-400/40 hover:bg-slate-900/75',
        className
      )}
    >
      {/* Subtle top amber highlight hairline */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <CloudSun className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              Live Micro-Climate
            </div>
            <div className="text-[10px] text-slate-400 font-mono">{location}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono">LIVE 1s</span>
        </div>
      </div>

      {/* Primary Temperature & Metrics Grid */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-slate-200">
        {/* Temperature */}
        <div className="flex flex-col rounded-xl bg-white/[0.04] p-2 border border-white/5">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <SunMedium className="h-3 w-3 text-amber-400" />
            <span>Ambient</span>
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span className="text-base font-bold text-white font-mono">{temperature}°</span>
            <span className="text-[10px] text-slate-400">C</span>
          </div>
        </div>

        {/* Cloud Cover */}
        <div className="flex flex-col rounded-xl bg-white/[0.04] p-2 border border-white/5">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <CloudSun className="h-3 w-3 text-teal-400" />
            <span>Cloud</span>
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span className="text-base font-bold text-white font-mono">{cloudCover}%</span>
            <span className="text-[9px] text-emerald-400 font-medium ml-1">Clear</span>
          </div>
        </div>

        {/* Wind Speed */}
        <div className="flex flex-col rounded-xl bg-white/[0.04] p-2 border border-white/5">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Wind className="h-3 w-3 text-sky-400" />
            <span>Wind</span>
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span className="text-base font-bold text-white font-mono">{windSpeedKmh}</span>
            <span className="text-[10px] text-slate-400">km/h</span>
          </div>
        </div>

        {/* Humidity */}
        <div className="flex flex-col rounded-xl bg-white/[0.04] p-2 border border-white/5">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Droplets className="h-3 w-3 text-teal-400" />
            <span>Humidity</span>
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span className="text-base font-bold text-teal-300 font-mono">{humidity}%</span>
            <span className="text-[9px] text-slate-400 ml-1">RH</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
