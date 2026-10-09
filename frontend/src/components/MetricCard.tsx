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

// RGB triplets for the card's accent glow, keyed by the Tailwind colour in `iconColor`.
const ACCENT_RGB: Record<string, string> = {
  emerald: '16, 185, 129',
  green: '34, 197, 94',
  teal: '20, 184, 166',
  cyan: '6, 182, 212',
  sky: '14, 165, 233',
  blue: '59, 130, 246',
  indigo: '99, 102, 241',
  violet: '139, 92, 246',
  purple: '168, 85, 247',
  pink: '236, 72, 153',
  rose: '244, 63, 94',
  red: '239, 68, 68',
  orange: '249, 115, 22',
  amber: '245, 158, 11',
  yellow: '234, 179, 8',
  slate: '148, 163, 184',
};

const accentFor = (iconColor: string) => {
  const name = iconColor.match(/text-([a-z]+)-\d+/)?.[1] ?? 'emerald';
  return ACCENT_RGB[name] ?? ACCENT_RGB.emerald;
};

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
  const accent = accentFor(iconColor);
  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/70 p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-xl"
      style={{ '--accent': accent } as React.CSSProperties}
    >
      {/* Accent glow and top edge */}
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(var(--accent),0.18),transparent_70%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(var(--accent),0.6),transparent)]" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3">
        <span className="pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{title}</span>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${iconBg} shadow-[0_0_20px_-6px_rgba(var(--accent),0.6)]`}>
          <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
        </div>
      </div>

      {/* Main Value */}
      <div className="relative mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-[28px] font-bold leading-none tracking-tight text-white tabular-nums">{value}</span>
        {unit && <span className="text-xs font-semibold text-slate-400">{unit}</span>}
      </div>

      {/* Footer / Trend */}
      {(subtitle || trend || badge) && (
        <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
          {subtitle && <span className="truncate text-xs text-slate-400">{subtitle}</span>}
          {trend && (
            <span className={`text-xs font-medium ${trend.isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
              {trend.value} {trend.label}
            </span>
          )}
          {badge && <div>{badge}</div>}
        </div>
      )}
    </div>
  );
};
