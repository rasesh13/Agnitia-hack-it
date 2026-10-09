import { ArrowDownLeft, ArrowUpRight, BatteryCharging, BellOff, Building2, ChevronRight, Leaf, PlugZap, RefreshCw, Sun, TrendingUp, Wind, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconChip, Ring } from '../components/ui';
import { AlertCard } from './Alerts';
import { greeting, inr, kw, num, timeAgo } from '../lib/format';
import { askNotificationsOnce, requestNotificationPermission } from '../lib/notify';
import { useApp } from '../state/AppState';

export function Home({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { session, snapshot, activeAlerts, online, lastError, refresh, refreshing, setTab, settings } = useApp();
  const [permission, setPermission] = useState<string>('granted');

  useEffect(() => {
    askNotificationsOnce().then(setPermission);
  }, []);

  const aggregate = snapshot?.twin.aggregate;
  const generation = aggregate?.total_generation_kw ?? 0;
  const demand = aggregate?.total_building_demand_kw ?? 0;
  const share = demand > 0 ? Math.min(100, (generation / demand) * 100) : 0;
  const soc = aggregate?.average_battery_soc_percent ?? null;
  const charging = (aggregate?.net_battery_kw ?? 0) < 0;
  const importing = (aggregate?.net_grid_flow_kw ?? 0) > 0.5;
  const exporting = (aggregate?.grid_export_kw ?? 0) > 0.5;
  const totalAssets = snapshot?.twin.assets.length ?? 0;
  const onlineAssets = snapshot?.twin.assets.filter((asset) => asset.operational_status === 'online').length ?? 0;
  const initials = (session?.user.email ?? '?').slice(0, 2).toUpperCase();
  const statusColor = session?.demo ? '#8b5cf6' : online ? '#10b981' : '#f43f5e';

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">
          <small>{greeting()}</small>
          <h1>Prestige Microgrid</h1>
        </div>
        <button className="avatar" onClick={onOpenSettings} aria-label="Settings and account">
          {initials}
          <span className="dot" style={{ background: statusColor }} />
        </button>
      </div>

      {session?.demo && (
        <div className="banner demo">
          Sample data. Sign in to a SURYA server for live readings.
        </div>
      )}
      {!online && !session?.demo && (
        <div className="banner bad">
          <WifiOff size={16} />
          <span>{lastError ?? 'Server unreachable'}</span>
          <button className="link" onClick={refresh}>
            Retry
          </button>
        </div>
      )}
      {permission !== 'granted' && permission !== 'unsupported' && settings.notifications && (
        <div className="banner warn">
          <BellOff size={16} />
          <span>{permission === 'denied' ? 'Notifications are off. Alerts will only show in the app.' : 'Allow notifications to get alerts'}</span>
          <button className="link" onClick={async () => setPermission(await requestNotificationPermission())}>
            Allow
          </button>
        </div>
      )}

      <div className="hero">
        <div className="hero-top">
          <span className="pill glass">
            <span className="pulse" style={{ color: statusColor }} />
            {session?.demo ? 'Demo' : online ? 'Live' : 'Offline'}
            {snapshot && <span style={{ opacity: 0.75, fontWeight: 600 }}> • {timeAgo(snapshot.fetchedAt)}</span>}
          </span>
          <button onClick={refresh} aria-label="Refresh" style={{ color: '#fff', opacity: 0.85 }}>
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
        <div className="hero-main">
          <Ring value={share} size={96}>
            <div>
              <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{Math.round(share)}%</div>
              <div style={{ fontSize: 10, opacity: 0.75 }}>renewable</div>
            </div>
          </Ring>
          <div>
            <div className="hero-value num">
              {snapshot ? num(generation) : '—'}
              <small>kW</small>
            </div>
            <div className="hero-label">Clean generation now</div>
            <div className="hero-label" style={{ marginTop: 2 }}>
              Campus load {snapshot ? kw(demand) : '—'}
            </div>
          </div>
        </div>
        <div className="hero-flows">
          <div className="hero-flow">
            <span>
              <Sun size={11} /> Solar
            </span>
            <b className="num">{kw(aggregate?.total_solar_kw)}</b>
          </div>
          <div className="hero-flow">
            <span>
              <Wind size={11} /> Wind
            </span>
            <b className="num">{kw(aggregate?.total_wind_kw)}</b>
          </div>
          <div className="hero-flow">
            <span>
              {exporting ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />} {exporting ? 'Export' : 'Grid'}
            </span>
            <b className="num">{kw(exporting ? aggregate?.grid_export_kw : aggregate?.grid_import_kw)}</b>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="card tile">
          <div className="tile-head">
            <IconChip icon={BatteryCharging} color="#7c3aed" bg="#f3efff" />
            <span className={`pill ${soc !== null && soc < settings.batteryLowSoc ? 'warn' : 'live'}`}>{charging ? 'Charging' : 'Discharging'}</span>
          </div>
          <div>
            <div className="tile-label">Battery</div>
            <div className="tile-value num">
              {soc === null ? '—' : soc.toFixed(0)}
              <small>%</small>
            </div>
          </div>
          <div className="bar">
            <i style={{ width: `${soc ?? 0}%`, background: soc !== null && soc < settings.batteryLowSoc ? '#f59e0b' : 'linear-gradient(90deg,#8b5cf6,#4338ca)' }} />
          </div>
        </div>
        <div className="card tile">
          <div className="tile-head">
            <IconChip icon={PlugZap} color="#2563eb" bg="#eef3ff" />
            <span className={`pill ${importing ? 'warn' : 'live'}`}>{importing ? 'Importing' : exporting ? 'Exporting' : 'Balanced'}</span>
          </div>
          <div>
            <div className="tile-label">Grid flow</div>
            <div className="tile-value num">
              {aggregate ? num(Math.abs(aggregate.net_grid_flow_kw)) : '—'}
              <small>kW</small>
            </div>
          </div>
          <div className="hint">MPPKVVCL 11kV feeder</div>
        </div>
        <div className="card tile">
          <div className="tile-head">
            <IconChip icon={Building2} color="#e11d48" bg="#fff0f3" />
          </div>
          <div>
            <div className="tile-label">Campus load</div>
            <div className="tile-value num">
              {aggregate ? num(demand) : '—'}
              <small>kW</small>
            </div>
          </div>
          <div className="hint">Academic, admin & hostels</div>
        </div>
        <div className="card tile">
          <div className="tile-head">
            <IconChip icon={Leaf} color="#059669" bg="#ebfbf4" />
          </div>
          <div>
            <div className="tile-label">Assets online</div>
            <div className="tile-value num">
              {snapshot ? onlineAssets : '—'}
              <small>/ {totalAssets || '—'}</small>
            </div>
          </div>
          <div className="hint">Quality: {aggregate?.overall_quality ?? '—'}</div>
        </div>
      </div>

      <div className="section-title">
        <h2>Needs attention</h2>
        <button onClick={() => setTab('alerts')}>See all</button>
      </div>
      {activeAlerts.length === 0 ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconChip icon={Leaf} color="#059669" bg="#ebfbf4" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>All systems normal</div>
            <div className="hint">No active alerts on the microgrid.</div>
          </div>
        </div>
      ) : (
        <div className="stack">
          {activeAlerts.slice(0, 2).map((alert) => (
            <AlertCard key={`${alert.key}-${alert.raisedAt}`} alert={alert} compact />
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>Optimizer</h2>
        <button onClick={() => setTab('insights')}>Insights</button>
      </div>
      <button className="card" style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => setTab('insights')}>
        <IconChip icon={TrendingUp} color="#d97706" bg="#fff7e6" size={44} />
        <div style={{ flex: 1 }}>
          <div className="tile-label">Savings to date</div>
          <div className="num" style={{ fontSize: 20, fontWeight: 800 }}>{inr(snapshot?.stats?.total_savings_inr)}</div>
          <div className="hint">
            {num(snapshot?.stats?.total_carbon_reduction_kg)} kg CO₂ avoided • last cycle {snapshot?.cycle?.status ?? '—'}
          </div>
        </div>
        <ChevronRight size={18} color="#8a91ad" />
      </button>
    </div>
  );
}
