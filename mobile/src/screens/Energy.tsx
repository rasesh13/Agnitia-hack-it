import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { assetMeta, IconChip, Ring, Sheet } from '../components/ui';
import { kw, num, titleCase } from '../lib/format';
import type { AssetState } from '../lib/types';
import { useApp } from '../state/AppState';

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'solar', label: 'Solar' },
  { id: 'wind', label: 'Wind' },
  { id: 'battery', label: 'Battery' },
  { id: 'building', label: 'Buildings' },
  { id: 'grid', label: 'Grid' },
] as const;

const inGroup = (asset: AssetState, group: string) =>
  group === 'all' || (group === 'grid' ? ['grid_interconnection', 'meter', 'substation'].includes(asset.asset_type) : asset.asset_type === group);

const statusPill = (status: string) => (status === 'online' ? 'live' : status === 'degraded' ? 'warn' : 'bad');

function AssetDetail({ asset }: { asset: AssetState }) {
  const meta = assetMeta(asset.asset_type);
  const load = asset.active_power_kw !== null && asset.rated_capacity_kw ? Math.abs(asset.active_power_kw) / asset.rated_capacity_kw : 0;
  const facts: [string, string][] = [
    ['Active power', kw(asset.active_power_kw, 1)],
    ['Rated capacity', kw(asset.rated_capacity_kw)],
    ...(asset.soc_percent !== null ? [['State of charge', `${num(asset.soc_percent, 1)}%`] as [string, string]] : []),
    ...(asset.health_percent !== null ? [['Health', `${num(asset.health_percent, 1)}%`] as [string, string]] : []),
    ...(asset.temperature_celsius !== null ? [['Temperature', `${num(asset.temperature_celsius, 1)} °C`] as [string, string]] : []),
    ...(asset.wind_speed_ms !== null ? [['Wind speed', `${num(asset.wind_speed_ms, 1)} m/s`] as [string, string]] : []),
    ...(asset.voltage_v !== null ? [['Voltage', `${num(asset.voltage_v, 1)} V`] as [string, string]] : []),
    ...(asset.frequency_hz !== null ? [['Frequency', `${num(asset.frequency_hz, 2)} Hz`] as [string, string]] : []),
    ['Telemetry quality', titleCase(asset.telemetry_quality)],
    ['Asset ID', asset.asset_id],
  ];
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Ring value={(asset.soc_percent ?? load * 100) || 0} size={78} stroke={8} color={meta.color} track="#e9ecf5">
          <IconChip icon={meta.icon} color={meta.color} bg={meta.bg} size={40} />
        </Ring>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>{asset.name}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <span className={`pill ${statusPill(asset.operational_status)}`}>{titleCase(asset.operational_status)}</span>
            <span className="pill demo" style={{ background: meta.bg, color: meta.color }}>
              {meta.label}
            </span>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: '4px 16px' }}>
        {facts.map(([label, value]) => (
          <div className="row" key={label}>
            <div className="row-main row-sub" style={{ fontSize: 13.5, marginTop: 0 }}>
              {label}
            </div>
            <div className="row-value num" style={{ fontSize: 14 }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function Energy() {
  const { snapshot } = useApp();
  const [group, setGroup] = useState<(typeof GROUPS)[number]['id']>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const assets = snapshot?.twin.assets ?? [];
  const list = useMemo(() => assets.filter((asset) => inGroup(asset, group)), [assets, group]);
  const current = assets.find((asset) => asset.asset_id === selected) ?? null;
  const aggregate = snapshot?.twin.aggregate;

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">
          <small>{assets.length} monitored assets</small>
          <h1>Energy</h1>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', padding: '14px 8px' }}>
        {[
          ['Generation', aggregate?.total_generation_kw, '#d97706'],
          ['Demand', aggregate?.total_building_demand_kw, '#e11d48'],
          ['Battery', aggregate ? -aggregate.net_battery_kw : null, '#7c3aed'],
        ].map(([label, value, color]) => (
          <div key={label as string} style={{ borderLeft: label === 'Generation' ? 'none' : '1px solid #e6e9f2' }}>
            <div className="tile-label">{label as string}</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 800, color: color as string, marginTop: 4 }}>
              {kw(value as number | null)}
            </div>
          </div>
        ))}
      </div>

      <div className="chips" style={{ marginTop: 14 }}>
        {GROUPS.map((item) => (
          <button key={item.id} className={`chip ${group === item.id ? 'active' : ''}`} onClick={() => setGroup(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '2px 14px' }}>
        {list.length === 0 && <div className="empty">{snapshot ? 'No assets in this group.' : 'Loading assets…'}</div>}
        {list.map((asset) => {
          const meta = assetMeta(asset.asset_type);
          const share = asset.rated_capacity_kw ? Math.min(100, (Math.abs(asset.active_power_kw ?? 0) / asset.rated_capacity_kw) * 100) : 0;
          return (
            <button key={asset.asset_id} className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSelected(asset.asset_id)}>
              <IconChip icon={meta.icon} color={meta.color} bg={meta.bg} size={42} />
              <div className="row-main">
                <div className="row-title">{asset.name}</div>
                <div className="row-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: asset.operational_status === 'online' ? '#10b981' : '#f43f5e' }} />
                  {asset.soc_percent !== null ? `${num(asset.soc_percent)}% charged` : `${Math.round(share)}% of ${kw(asset.rated_capacity_kw)}`}
                </div>
              </div>
              <div className="row-value num">
                {kw(asset.active_power_kw, 1)}
                <small>{asset.asset_type === 'battery' ? ((asset.active_power_kw ?? 0) < 0 ? 'charging' : 'discharging') : titleCase(asset.telemetry_quality)}</small>
              </div>
              <ChevronRight size={16} color="#c2c7d8" />
            </button>
          );
        })}
      </div>

      <Sheet open={current !== null} onClose={() => setSelected(null)}>
        {current && <AssetDetail asset={current} />}
      </Sheet>
    </div>
  );
}
