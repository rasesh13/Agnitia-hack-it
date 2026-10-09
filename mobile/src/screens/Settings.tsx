import { ArrowLeft, BellRing, LogOut, Send, Server, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SuryaMark } from '../components/SuryaMark';
import { IconChip, Toast, Toggle } from '../components/ui';
import { notificationPermission, requestNotificationPermission, sendTestNotification } from '../lib/notify';
import type { AppSettings } from '../lib/types';
import { useApp } from '../state/AppState';

function Stepper({ value, step, min, max, unit, onChange }: { value: number; step: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label="Decrease">
        −
      </button>
      <b className="num">
        {value}
        {unit}
      </b>
      <button onClick={() => onChange(Math.min(max, value + step))} aria-label="Increase">
        +
      </button>
    </div>
  );
}

export function SettingsPage({ onClose }: { onClose: () => void }) {
  const { session, settings, updateSettings, signOut } = useApp();
  const [permission, setPermission] = useState<string>('…');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    notificationPermission().then(setPermission);
  }, []);

  const set = (patch: Partial<AppSettings>) => updateSettings(patch);

  const test = async () => {
    let status = permission;
    if (status !== 'granted') status = await requestNotificationPermission();
    setPermission(status);
    if (status === 'unsupported') setToast('Notifications work in the Android app.');
    else if (status !== 'granted') setToast('Notifications are blocked in Android settings.');
    else {
      await sendTestNotification();
      setToast('Test notification sent');
    }
  };

  const thresholds: { key: keyof AppSettings; label: string; hint: string; step: number; min: number; max: number; unit: string }[] = [
    { key: 'batteryLowSoc', label: 'Battery low', hint: 'Warn below this charge', step: 5, min: 10, max: 60, unit: '%' },
    { key: 'batteryCriticalSoc', label: 'Battery critical', hint: 'Critical alert below this charge', step: 5, min: 5, max: 40, unit: '%' },
    { key: 'gridImportKw', label: 'Grid import limit', hint: 'Warn when importing more', step: 50, min: 50, max: 1000, unit: ' kW' },
    { key: 'staleSeconds', label: 'Stale telemetry', hint: 'Warn when readings are older', step: 30, min: 30, max: 900, unit: ' s' },
    { key: 'refreshSeconds', label: 'Refresh every', hint: 'While the app is open', step: 5, min: 5, max: 60, unit: ' s' },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <button className="icon-btn" onClick={onClose} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <h1>Settings</h1>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconChip icon={UserRound} color="#4338ca" bg="#eef0ff" size={46} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 750, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.user.email}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
            <span className="pill demo" style={{ textTransform: 'capitalize' }}>
              {session?.user.role}
            </span>
            {session?.demo && <span className="pill warn">Sample data</span>}
          </div>
        </div>
      </div>
      {!session?.demo && (
        <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 4px 0' }}>
          <Server size={13} /> {session?.serverUrl}
        </div>
      )}

      <div className="section-title">
        <h2>Notifications</h2>
        <span className={`pill ${permission === 'granted' ? 'live' : 'warn'}`}>{permission === 'granted' ? 'Allowed' : permission === 'unsupported' ? 'Web preview' : 'Not allowed'}</span>
      </div>
      <div className="card" style={{ padding: '2px 16px' }}>
        <div className="setting">
          <div className="setting-text">
            <b>Alert notifications</b>
            <small>Phone notifications for new alerts</small>
          </div>
          <Toggle on={settings.notifications} onChange={(value) => set({ notifications: value })} label="Alert notifications" />
        </div>
        <div className="setting">
          <div className="setting-text">
            <b>Include warnings</b>
            <small>Off: only critical alerts notify</small>
          </div>
          <Toggle on={settings.notifyWarnings} onChange={(value) => set({ notifyWarnings: value })} label="Include warnings" />
        </div>
        <div className="setting">
          <div className="setting-text">
            <b>Resolved updates</b>
            <small>Notify when a condition clears</small>
          </div>
          <Toggle on={settings.notifyResolved} onChange={(value) => set({ notifyResolved: value })} label="Resolved updates" />
        </div>
      </div>
      <button className="btn ghost" style={{ marginTop: 10 }} onClick={test}>
        <Send size={16} color="#4338ca" />
        Send a test notification
      </button>
      <p className="hint" style={{ margin: '10px 4px 0' }}>
        <BellRing size={12} style={{ verticalAlign: -2 }} /> While the app is closed, SURYA checks the server about every 15 minutes (Android's minimum) for battery, grid, equipment and emergency-stop alerts.
      </p>

      <div className="section-title">
        <h2>Alert thresholds</h2>
      </div>
      <div className="card" style={{ padding: '2px 16px' }}>
        {thresholds.map((item) => (
          <div className="setting" key={item.key}>
            <div className="setting-text">
              <b>{item.label}</b>
              <small>{item.hint}</small>
            </div>
            <Stepper value={settings[item.key] as number} step={item.step} min={item.min} max={item.max} unit={item.unit} onChange={(value) => set({ [item.key]: value })} />
          </div>
        ))}
      </div>

      <div className="section-title">
        <h2>About</h2>
      </div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SuryaMark size={44} />
        <div>
          <b>SURYA Ops 1.0</b>
          <div className="hint">Smart Unified Renewable Yield Automation • Prestige University, Indore</div>
        </div>
      </div>

      <button className="btn ghost" style={{ marginTop: 18, color: '#e11d48' }} onClick={signOut}>
        <LogOut size={17} />
        Sign out
      </button>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
