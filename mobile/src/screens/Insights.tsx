import { Activity, Cpu, Leaf, Loader2, TrendingUp, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { IconChip, Sheet } from '../components/ui';
import { api } from '../lib/api';
import { inr, num, timeAgo, titleCase } from '../lib/format';
import type { Decision } from '../lib/types';
import { useApp } from '../state/AppState';

const PAGE = 15;

export function Insights() {
  const { session, snapshot } = useApp();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Decision | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setDecisions(await api.decisions(session, limit));
    } catch {
      // Keep the last list; connection problems surface on Home and Alerts.
    } finally {
      setLoading(false);
    }
  }, [session, limit]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const stats = snapshot?.stats;
  const cycle = snapshot?.cycle;
  const unhealthy = Object.entries(cycle?.health_summary ?? {}).filter(([, value]) => value !== 'healthy');

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">
          <small>Optimizer & savings</small>
          <h1>Insights</h1>
        </div>
      </div>

      <div className="hero" style={{ padding: 18 }}>
        <div className="hero-top">
          <span>Savings to date</span>
          <TrendingUp size={18} />
        </div>
        <div className="hero-value num" style={{ marginTop: 10 }}>
          {inr(stats?.total_savings_inr)}
        </div>
        <div className="hero-flows" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="hero-flow">
            <span>
              <Leaf size={11} /> CO₂ avoided
            </span>
            <b className="num">{num(stats?.total_carbon_reduction_kg)} kg</b>
          </div>
          <div className="hero-flow">
            <span>
              <Cpu size={11} /> Decisions
            </span>
            <b className="num">{num(stats?.total_decisions)}</b>
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>Latest cycle</h2>
      </div>
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <IconChip icon={Activity} color={cycle?.status === 'completed' ? '#059669' : '#d97706'} bg={cycle?.status === 'completed' ? '#ebfbf4' : '#fff7e6'} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b style={{ fontSize: 15 }}>{cycle ? titleCase(cycle.status) : '—'}</b>
            {cycle && <span className="hint">{timeAgo(cycle.cycle_started_at)}</span>}
          </div>
          <div className="hint" style={{ marginTop: 3 }}>
            {cycle?.duration_ms ? `${num(cycle.duration_ms, 1)} ms` : ''}
            {unhealthy.length ? ` • degraded: ${unhealthy.map(([name]) => name.replace(/_/g, ' ')).join(', ')}` : cycle ? ' • all inputs healthy' : ''}
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>Decision feed</h2>
        <span className="hint">auto-updates</span>
      </div>
      {loading ? (
        <div className="empty">
          <Loader2 className="spin" />
        </div>
      ) : decisions.length === 0 ? (
        <div className="card empty">No decisions recorded yet.</div>
      ) : (
        <div className="card" style={{ padding: '2px 14px' }}>
          {decisions.map((decision) => (
            <button key={decision.id} className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(decision)}>
              <IconChip icon={Zap} color="#4338ca" bg="#eef0ff" size={38} />
              <div className="row-main">
                <div className="row-title">{titleCase(decision.action)}</div>
                <div className="row-sub">
                  {titleCase(decision.decision_type)} • {timeAgo(decision.created_at)}
                </div>
              </div>
              <div className="row-value num" style={{ color: '#059669' }}>
                +{inr(decision.expected_savings_inr)}
                <small>{num(decision.carbon_impact_kg, 1)} kg CO₂</small>
              </div>
            </button>
          ))}
        </div>
      )}
      {decisions.length >= limit && (
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setLimit((value) => value + PAGE)}>
          Load more
        </button>
      )}

      <Sheet open={open !== null} onClose={() => setOpen(null)}>
        {open && (
          <>
            <div style={{ fontWeight: 800, fontSize: 19 }}>{titleCase(open.action)}</div>
            <div className="hint" style={{ marginTop: 4 }}>
              {titleCase(open.decision_type)} • {new Date(open.created_at.endsWith('Z') ? open.created_at : `${open.created_at}Z`).toLocaleString('en-IN')}
            </div>
            <div className="card" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.55, color: '#4a5272' }}>
              {open.reason}
            </div>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div className="card">
                <div className="tile-label">Expected saving</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>{inr(open.expected_savings_inr)}</div>
              </div>
              <div className="card">
                <div className="tile-label">Carbon impact</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 800 }}>{num(open.carbon_impact_kg, 1)} kg</div>
              </div>
              <div className="card">
                <div className="tile-label">Confidence</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 800 }}>{Math.round((open.confidence ?? 0) * 100)}%</div>
              </div>
              <div className="card">
                <div className="tile-label">Setpoint</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 800 }}>{open.setpoint_kw ? `${num(open.setpoint_kw)} kW` : '—'}</div>
              </div>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
