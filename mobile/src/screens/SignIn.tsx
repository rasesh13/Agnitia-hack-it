import { AlertCircle, BellRing, Eye, EyeOff, Loader2, Server, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { SuryaMark } from '../components/SuryaMark';
import { IconChip } from '../components/ui';
import { api, ApiError, normaliseServerUrl } from '../lib/api';
import { askNotificationsOnce } from '../lib/notify';
import { storage } from '../lib/storage';
import { useApp } from '../state/AppState';

// The SURYA backend on the operator's PC; editable on the form.
const DEFAULT_SERVER = 'http://172.10.21.55:8010';
const DEMO_ACCOUNT = { email: 'admin@prestige.edu.in', password: 'SuryaAdmin2026!' };

export function SignIn() {
  const { signIn, lastError } = useApp();
  const [step, setStep] = useState<'welcome' | 'form'>('welcome');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'login' | 'demo-account' | 'test' | null>(null);
  const [error, setError] = useState<string | null>(lastError);
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const [saved, onboarded] = await Promise.all([storage.lastServer(), storage.isOnboarded()]);
      if (saved) setServerUrl(saved);
      if (onboarded) setStep('form');
    })();
  }, []);

  const begin = async () => {
    await storage.markOnboarded();
    setStep('form');
  };

  const testServer = async () => {
    setBusy('test');
    setError(null);
    try {
      await api.health(normaliseServerUrl(serverUrl));
      setServerOk(true);
    } catch (err) {
      setServerOk(false);
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const login = async (credentials: { email: string; password: string }, kind: 'login' | 'demo-account') => {
    setBusy(kind);
    setError(null);
    const url = normaliseServerUrl(serverUrl);
    try {
      const result = await api.login(url, credentials.email.trim(), credentials.password);
      // Ask before the first data arrives so the first alerts can notify.
      await askNotificationsOnce();
      await signIn({ serverUrl: url, token: result.access_token, user: result.user, demo: false, signedInAt: Date.now() });
    } catch (err) {
      setError((err as ApiError).status === 401 ? 'Incorrect email or password.' : (err as ApiError).message);
      setBusy(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    login({ email, password }, 'login');
  };

  const exploreDemo = async () => {
    await askNotificationsOnce();
    await signIn({ serverUrl: '', token: '', user: { id: 0, email: 'demo@surya.app', role: 'admin' }, demo: true, signedInAt: Date.now() });
  };

  if (step === 'welcome') {
    return (
      <div className="welcome">
        <SuryaMark size={64} className="drop" />
        <h1>
          Your campus microgrid,
          <br />
          <em>in your pocket.</em>
        </h1>
        <p>SURYA Ops keeps Prestige University's solar, wind, battery and grid in view, and taps you on the shoulder the moment something needs attention.</p>
        <div className="card" style={{ marginTop: 24, padding: '6px 16px' }}>
          <div className="feature">
            <IconChip icon={BellRing} color="#e11d48" bg="#fff0f3" />
            Instant alerts for battery, grid, equipment and safety events
          </div>
          <div className="feature">
            <IconChip icon={Zap} color="#d97706" bg="#fff7e6" />
            Live generation, load and battery at a glance
          </div>
          <div className="feature">
            <IconChip icon={ShieldCheck} color="#4338ca" bg="#eef0ff" />
            Optimizer decisions, savings and emergency controls
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 24 }} />
        <button className="btn primary" onClick={begin}>
          Get started
        </button>
      </div>
    );
  }

  return (
    <div className="welcome">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SuryaMark size={44} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>SURYA Ops</div>
          <div className="hint">Prestige University, Indore</div>
        </div>
      </div>
      <h1 style={{ fontSize: 26, marginTop: 28 }}>Sign in</h1>
      <p style={{ marginBottom: 20 }}>Use your SURYA operations account.</p>

      {error && (
        <div className="error">
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      <form onSubmit={submit}>
        <label className="field">
          <span>Server address</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={serverUrl}
              onChange={(event) => {
                setServerUrl(event.target.value);
                setServerOk(null);
              }}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="button" className="icon-btn" style={{ width: 50, height: 50, borderRadius: 14 }} onClick={testServer} aria-label="Test server">
              {busy === 'test' ? (
                <Loader2 size={18} className="spin" />
              ) : (
                <Server size={18} color={serverOk === true ? '#10b981' : serverOk === false ? '#f43f5e' : '#4a5272'} />
              )}
            </button>
          </div>
        </label>
        {serverOk && <div className="hint" style={{ margin: '-6px 4px 12px', color: '#047857', fontWeight: 600 }}>Server is reachable.</div>}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoCapitalize="none" autoComplete="username" placeholder="you@prestige.edu.in" />
        </label>
        <label className="field">
          <span>Password</span>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              style={{ paddingRight: 48 }}
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Show password" style={{ position: 'absolute', right: 14, top: 14, color: '#8a91ad' }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <button className="btn primary" type="submit" disabled={busy !== null}>
          {busy === 'login' && <Loader2 size={18} className="spin" />}
          Sign in
        </button>
      </form>

      <button className="btn ghost" style={{ marginTop: 10 }} disabled={busy !== null} onClick={() => login(DEMO_ACCOUNT, 'demo-account')}>
        {busy === 'demo-account' ? <Loader2 size={18} className="spin" /> : <Zap size={17} color="#d97706" />}
        Prestige admin demo account
      </button>

      <div className="divider">no server nearby?</div>
      <button className="btn ghost" onClick={exploreDemo} disabled={busy !== null}>
        <Sparkles size={17} color="#7c3aed" />
        Explore with sample data
      </button>
      <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
        Your phone must be on the same Wi-Fi as the SURYA server.
      </p>
    </div>
  );
}
