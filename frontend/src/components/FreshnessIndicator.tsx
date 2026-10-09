import React from 'react';
import { Activity, Clock } from 'lucide-react';

interface FreshnessIndicatorProps {
  isStale: boolean;
  stalenessSeconds: number;
  lastUpdate?: Date | string | null;
}

export const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({
  isStale,
  stalenessSeconds,
  lastUpdate,
}) => {
  const formattedTime = lastUpdate
    ? typeof lastUpdate === 'string'
      ? new Date(lastUpdate).toLocaleTimeString()
      : lastUpdate.toLocaleTimeString()
    : stalenessSeconds <= 2
    ? 'just now'
    : `${stalenessSeconds}s ago`;

  if (isStale) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-950/40 px-3 py-1 text-xs font-semibold text-orange-300 shadow-sm">
        <Clock className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
        <span>Stale ({stalenessSeconds}s ago)</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-300 shadow-sm">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <Activity className="h-3.5 w-3.5 text-emerald-400" />
      <span>Live • {formattedTime}</span>
    </div>
  );
};
