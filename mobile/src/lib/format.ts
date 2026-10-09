export const kw = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : Math.abs(value) >= 1000
    ? `${(value / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} MW`
    : `${value.toLocaleString('en-IN', { maximumFractionDigits: digits })} kW`;

export const num = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : value.toLocaleString('en-IN', { maximumFractionDigits: digits });

export const inr = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `₹${Math.round(value).toLocaleString('en-IN')}`;

export const pct = (value: number | null | undefined, digits = 0) => (value === null || value === undefined ? '—' : `${value.toFixed(digits)}%`);

export function timeAgo(timestamp: number | string) {
  const time = typeof timestamp === 'string' ? Date.parse(timestamp.endsWith('Z') || timestamp.includes('+') ? timestamp : `${timestamp}Z`) : timestamp;
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const clock = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const titleCase = (text: string) => text.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
