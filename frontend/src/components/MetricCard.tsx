import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: {
    value: string;
    isPositive: boolean;
    label?: string;
  };
  badge?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  iconColor = 'text-emerald-400',
  iconBg = 'bg-emerald-500/10 border-emerald-500/20',
  trend,
  badge,
}) => {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur-sm transition-all hover:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>

      {/* Main Value */}
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        {unit && <span className="text-xs font-semibold text-slate-400">{unit}</span>}
      </div>

      {/* Footer / Trend */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
        {subtitle && <span className="text-xs text-slate-400 truncate">{subtitle}</span>}
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.isPositive ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {trend.value} {trend.label}
          </span>
        )}
        {badge && <div>{badge}</div>}
      </div>
    </div>
  );
};
