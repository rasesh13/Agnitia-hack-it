import { AlertOctagon, AlertTriangle, Battery, CheckCheck, CheckCircle2, Cpu, Info, PlugZap, ShieldAlert, Signal, WifiOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { IconChip } from '../components/ui';
import { timeAgo } from '../lib/format';
import type { AlertItem } from '../lib/types';
import { useApp } from '../state/AppState';

const CATEGORY_ICON = {
  battery: Battery,
  grid: PlugZap,
  telemetry: Signal,
  asset: Cpu,
  optimizer: Cpu,
  safety: ShieldAlert,
  connection: WifiOff,
} as const;

const SEVERITY_STYLE = {
  critical: { color: '#e11d48', bg: '#fff0f3', icon: AlertOctagon, label: 'Critical' },
  warning: { color: '#d97706', bg: '#fff7e6', icon: AlertTriangle, label: 'Warning' },
  info: { color: '#0284c7', bg: '#eaf7fe', icon: Info, label: 'Info' },
} as const;

export function AlertCard({ alert, compact = false }: { alert: AlertItem; compact?: boolean }) {
  const { acknowledge } = useApp();
  const resolved = alert.resolvedAt !== null;
  const style = SEVERITY_STYLE[alert.severity];
  const Icon = resolved ? CheckCircle2 : CATEGORY_ICON[alert.category] ?? style.icon;
  return (
    <div className={`card alert ${resolved ? 'resolved' : alert.severity}`}>
      <IconChip icon={Icon} color={resolved ? '#059669' : style.color} bg={resolved ? '#ebfbf4' : style.bg} size={40} />
      <div className="alert-body">
        <div className="alert-title">{alert.title}</div>
        {!compact && <div className="alert-text">{alert.body}</div>}
        <div className="alert-meta">
          <span className={`pill ${resolved ? 'live' : alert.severity === 'critical' ? 'bad' : 'warn'}`} style={{ padding: '3px 8px' }}>
            {resolved ? 'Resolved' : style.label}
          </span>
          <span>{resolved ? `cleared ${timeAgo(alert.resolvedAt!)}` : timeAgo(alert.raisedAt)}</span>
          {!resolved &&
            (alert.acknowledgedAt ? (
              <span style={{ marginLeft: 'auto', color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCheck size={14} /> Seen
              </span>
            ) : (
              <button className="ack" onClick={() => acknowledge(alert.key)}>
                Acknowledge
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'battery', label: 'Battery' },
  { id: 'grid', label: 'Grid' },
  { id: 'asset', label: 'Equipment' },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'optimizer', label: 'Optimizer' },
] as const;

export function Alerts() {
  const { alerts, activeAlerts, unacknowledged, acknowledgeAll, clearHistory } = useApp();
  const [view, setView] = useState<'active' | 'history'>('active');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');

  const history = alerts.filter((alert) => alert.resolvedAt !== null);
  const list = useMemo(() => {
    const source = view === 'active' ? activeAlerts : history;
    return source.filter((alert) => (filter === 'all' ? true : filter === 'critical' ? alert.severity === 'critical' : alert.category === filter));
  }, [view, activeAlerts, history, filter]);

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">
          <small>{activeAlerts.length ? `${activeAlerts.length} active • ${unacknowledged} new` : 'Microgrid is healthy'}</small>
          <h1>Alerts</h1>
        </div>
        {view === 'active' && unacknowledged > 0 && (
          <button className="link" onClick={acknowledgeAll}>
            Mark all seen
          </button>
        )}
        {view === 'history' && history.length > 0 && (
          <button className="link" onClick={clearHistory}>
            Clear
          </button>
        )}
      </div>

      <div className="segmented">
        <button className={view === 'active' ? 'active' : ''} onClick={() => setView('active')}>
          Active {activeAlerts.length ? `(${activeAlerts.length})` : ''}
        </button>
        <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
          History
        </button>
      </div>

      <div className="chips">
        {FILTERS.map((item) => (
          <button key={item.id} className={`chip ${filter === item.id ? 'active' : ''}`} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">
            <CheckCircle2 size={30} />
          </div>
          <b>{view === 'active' ? 'Nothing needs attention' : 'No past alerts yet'}</b>
          {view === 'active'
            ? 'You will get a notification as soon as a battery, grid, equipment or safety condition needs you.'
            : 'Alerts move here once their condition clears.'}
        </div>
      ) : (
        <div className="stack">
          {list.map((alert) => (
            <AlertCard key={`${alert.key}-${alert.raisedAt}`} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
