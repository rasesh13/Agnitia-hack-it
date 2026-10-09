import { Battery, Building2, Sun, UtilityPole, Wind, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

/** Circular progress ring used for renewable share and battery charge. */
export function Ring({ value, size = 92, stroke = 9, color = '#fbbf24', track = 'rgba(255,255,255,0.14)', children }: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

export function IconChip({ icon: Icon, color, bg, size = 36 }: { icon: LucideIcon; color: string; bg: string; size?: number }) {
  return (
    <div className="icon-chip" style={{ background: bg, color, width: size, height: size }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.2} />
    </div>
  );
}

export const ASSET_META: Record<string, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  solar: { icon: Sun, color: '#d97706', bg: '#fff7e6', label: 'Solar' },
  wind: { icon: Wind, color: '#0284c7', bg: '#eaf7fe', label: 'Wind' },
  battery: { icon: Battery, color: '#7c3aed', bg: '#f3efff', label: 'Battery' },
  building: { icon: Building2, color: '#e11d48', bg: '#fff0f3', label: 'Building' },
  grid_interconnection: { icon: UtilityPole, color: '#2563eb', bg: '#eef3ff', label: 'Grid' },
  meter: { icon: Zap, color: '#2563eb', bg: '#eef3ff', label: 'Meter' },
  substation: { icon: UtilityPole, color: '#2563eb', bg: '#eef3ff', label: 'Substation' },
};

export const assetMeta = (type: string) => ASSET_META[type] ?? ASSET_META.meter;

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        {children}
      </div>
    </>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}
