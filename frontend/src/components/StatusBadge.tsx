import React from 'react';
import { TelemetryQuality, AlertSeverity } from '../types';

interface QualityBadgeProps {
  quality: TelemetryQuality | string;
  size?: 'sm' | 'md';
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({ quality, size = 'sm' }) => {
  const q = (quality || '').toLowerCase();

  const styles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    good: {
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
      label: 'Good',
    },
    suspect: {
      bg: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
      label: 'Suspect',
    },
    stale: {
      bg: 'bg-orange-500/10 border-orange-500/30',
      text: 'text-orange-400',
      dot: 'bg-orange-400 animate-pulse',
      label: 'Stale',
    },
    missing: {
      bg: 'bg-slate-700/30 border-slate-600',
      text: 'text-slate-400',
      dot: 'bg-slate-500',
      label: 'Missing',
    },
    invalid: {
      bg: 'bg-red-500/10 border-red-500/30',
      text: 'text-red-400',
      dot: 'bg-red-400',
      label: 'Invalid',
    },
  };

  const current = styles[q] || styles.missing;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wider ${current.bg} ${current.text} ${padding}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
};

interface SeverityBadgeProps {
  severity: AlertSeverity | string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const s = (severity || '').toLowerCase();

  const styles: Record<string, { bg: string; text: string; label: string }> = {
    critical: {
      bg: 'bg-red-500/20 border-red-500/40',
      text: 'text-red-300',
      label: 'Critical',
    },
    warning: {
      bg: 'bg-amber-500/20 border-amber-500/40',
      text: 'text-amber-300',
      label: 'Warning',
    },
    info: {
      bg: 'bg-blue-500/20 border-blue-500/40',
      text: 'text-blue-300',
      label: 'Info',
    },
  };

  const current = styles[s] || styles.info;

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${current.bg} ${current.text}`}
    >
      {current.label}
    </span>
  );
};

interface OperationalStatusBadgeProps {
  status: string;
}

export const OperationalStatusBadge: React.FC<OperationalStatusBadgeProps> = ({ status }) => {
  const s = (status || '').toLowerCase();
  const isOnline = s === 'online' || s === 'active' || s === 'operating';
  const isDegraded = s === 'degraded' || s === 'standby';

  const colorClass = isOnline
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : isDegraded
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    : 'bg-slate-800 border-slate-700 text-slate-400';

  const dotClass = isOnline
    ? 'bg-emerald-400 animate-pulse'
    : isDegraded
    ? 'bg-amber-400'
    : 'bg-slate-500';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {status || 'Unknown'}
    </span>
  );
};
