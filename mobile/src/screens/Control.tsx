import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Gauge, Loader2, Lock, OctagonX, Play, ShieldCheck, Timer } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconChip, Sheet, Toast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { num } from '../lib/format';
import { useApp } from '../state/AppState';

const HOLD_MS = 1500;

export function Control() {
  const { session, snapshot, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [stopSheet, setStopSheet] = useState(false);
  const [reason, setReason] = useState('');
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<number | null>(null);

  const role = session?.user.role ?? 'viewer';
  const canOperate = role === 'admin' || role === 'operator';
  const isAdmin = role === 'admin';
  const policy = snapshot?.policy;
  const stopped = policy?.emergency_stop_active ?? false;

  const forceCycle = async () => {
    if (!session) return;
    setBusy(true);
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    try {
      const result = await api.forceCycle(session);
      setToast(`Cycle ${result.status} • ${result.decisions_count} decision${result.decisions_count === 1 ? '' : 's'}`);
      refresh();
    } catch (error) {
      setToast((error as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleStop = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await api.emergencyStop(session, !stopped, reason.trim());
      Haptics.notification({ type: stopped ? NotificationType.Success : NotificationType.Warning }).catch(() => undefined);
      setToast(stopped ? 'Emergency stop released' : 'Emergency stop engaged');
      setStopSheet(false);
      setReason('');
      refresh();
    } catch (error) {
      setToast((error as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const startHold = () => {
    if (reason.trim().length < 3 || busy) return;
    setHolding(true);
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    holdTimer.current = window.setTimeout(() => {
      setHolding(false);
      toggleStop();
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    setHolding(false);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">
          <small>Signed in as {role}</small>
          <h1>Control</h1>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, background: stopped ? '#fff0f3' : '#ebfbf4', borderColor: 'transparent' }}>
        <IconChip icon={stopped ? OctagonX : ShieldCheck} color={stopped ? '#e11d48' : '#059669'} bg="#ffffff" size={48} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{stopped ? 'Emergency stop engaged' : 'Dispatch running normally'}</div>
          <div className="hint" style={{ color: stopped ? '#9f1239' : '#047857' }}>
            {stopped ? 'Automated setpoints are frozen.' : policy?.closed_loop_enabled ? 'Closed-loop control is active.' : 'Advisory mode: decisions are recommended, not executed.'}
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>Actions</h2>
      </div>
      <div className="stack">
        <div className="card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <IconChip icon={Play} color="#4338ca" bg="#eef0ff" size={42} />
            <div>
              <b style={{ fontSize: 15 }}>Run optimization now</b>
              <div className="hint">Recompute dispatch from the latest telemetry instead of waiting for the next cycle.</div>
            </div>
          </div>
          <button className="btn primary" onClick={forceCycle} disabled={!canOperate || busy}>
            {busy ? <Loader2 size={18} className="spin" /> : canOperate ? <Play size={17} /> : <Lock size={16} />}
            {canOperate ? 'Force cycle' : 'Operators and admins only'}
          </button>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <IconChip icon={OctagonX} color="#e11d48" bg="#fff0f3" size={42} />
            <div>
              <b style={{ fontSize: 15 }}>Emergency stop</b>
              <div className="hint">Freezes all automated dispatch immediately. Requires a reason for the audit log.</div>
            </div>
          </div>
          <button className={`btn ${stopped ? 'sun' : 'danger'}`} onClick={() => setStopSheet(true)} disabled={!isAdmin || busy}>
            {isAdmin ? <OctagonX size={17} /> : <Lock size={16} />}
            {!isAdmin ? 'Administrators only' : stopped ? 'Release emergency stop' : 'Engage emergency stop'}
          </button>
        </div>
      </div>

      <div className="section-title">
        <h2>Control policy</h2>
      </div>
      <div className="card" style={{ padding: '2px 16px' }}>
        <div className="row">
          <IconChip icon={Gauge} color="#d97706" bg="#fff7e6" size={34} />
          <div className="row-main">
            <div className="row-title">Cost vs carbon</div>
            <div className="bar" style={{ marginTop: 8, display: 'flex' }}>
              <i style={{ width: `${(policy?.cost_weight ?? 0) * 100}%`, background: '#f59e0b', borderRadius: '6px 0 0 6px' }} />
              <i style={{ width: `${(policy?.carbon_weight ?? 0) * 100}%`, background: '#10b981', borderRadius: '0 6px 6px 0' }} />
            </div>
          </div>
          <div className="row-value num" style={{ fontSize: 13 }}>
            {policy ? `${Math.round(policy.cost_weight * 100)} / ${Math.round(policy.carbon_weight * 100)}` : '—'}
          </div>
        </div>
        <div className="row">
          <IconChip icon={Timer} color="#0284c7" bg="#eaf7fe" size={34} />
          <div className="row-main">
            <div className="row-title">Decision cadence</div>
            <div className="row-sub">How often the optimizer re-plans</div>
          </div>
          <div className="row-value num">{policy ? `${num(policy.decision_cycle_seconds)} s` : '—'}</div>
        </div>
        <div className="row">
          <IconChip icon={ShieldCheck} color="#4338ca" bg="#eef0ff" size={34} />
          <div className="row-main">
            <div className="row-title">Closed-loop dispatch</div>
            <div className="row-sub">Setpoints sent to inverters automatically</div>
          </div>
          <span className={`pill ${policy?.closed_loop_enabled ? 'live' : 'warn'}`}>{policy ? (policy.closed_loop_enabled ? 'On' : 'Advisory') : '—'}</span>
        </div>
      </div>

      <Sheet open={stopSheet} onClose={() => (!busy ? setStopSheet(false) : undefined)}>
        <div style={{ fontWeight: 800, fontSize: 19 }}>{stopped ? 'Release emergency stop?' : 'Engage emergency stop?'}</div>
        <p className="hint" style={{ fontSize: 13.5, margin: '6px 0 16px' }}>
          {stopped ? 'Automated dispatch will resume on the next optimizer cycle.' : 'All automated dispatch will freeze until an administrator releases it.'}
        </p>
        <label className="field">
          <span>Reason (recorded in the audit log)</span>
          <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={stopped ? 'e.g. Inspection complete' : 'e.g. Transformer smoke reported'} maxLength={255} />
        </label>
        <button
          className={`btn hold ${stopped ? 'sun' : 'danger'} ${holding ? 'holding' : ''}`}
          disabled={reason.trim().length < 3 || busy}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="fill" />
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {busy ? <Loader2 size={18} className="spin" /> : <OctagonX size={17} />}
            {reason.trim().length < 3 ? 'Enter a reason first' : 'Press and hold to confirm'}
          </span>
        </button>
      </Sheet>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
