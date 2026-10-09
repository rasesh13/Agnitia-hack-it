import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Bell, Home as HomeIcon, Lightbulb, SlidersHorizontal, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SuryaMark } from './components/SuryaMark';
import { Alerts } from './screens/Alerts';
import { Control } from './screens/Control';
import { Energy } from './screens/Energy';
import { Home } from './screens/Home';
import { Insights } from './screens/Insights';
import { SettingsPage } from './screens/Settings';
import { SignIn } from './screens/SignIn';
import { AppStateProvider, useApp } from './state/AppState';
import type { Tab } from './state/AppState';

const TABS: { id: Tab; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'energy', label: 'Energy', icon: Zap },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'control', label: 'Control', icon: SlidersHorizontal },
];

function Shell() {
  const { ready, session, tab, setTab, unacknowledged } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const stateRef = useRef({ tab, settingsOpen });
  stateRef.current = { tab, settingsOpen };

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hide().catch(() => undefined);
  }, [ready]);

  // Android back: close settings, then return to Home, then leave the app in the background.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const handle = CapApp.addListener('backButton', () => {
      if (stateRef.current.settingsOpen) setSettingsOpen(false);
      else if (stateRef.current.tab !== 'home') setTab('home');
      else CapApp.minimizeApp();
    });
    return () => {
      handle.then((listener) => listener.remove());
    };
  }, [setTab]);

  if (!ready) {
    return (
      <div className="splash">
        <SuryaMark size={84} />
      </div>
    );
  }

  if (!session) return <SignIn />;

  const select = (next: Tab) => {
    if (next !== tab) Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    setTab(next);
  };

  return (
    <div className="shell">
      {tab === 'home' && <Home onOpenSettings={() => setSettingsOpen(true)} />}
      {tab === 'alerts' && <Alerts />}
      {tab === 'energy' && <Energy />}
      {tab === 'insights' && <Insights />}
      {tab === 'control' && <Control />}

      <nav className="nav" aria-label="Main">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => select(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon size={21} strokeWidth={tab === id ? 2.4 : 2} />
            {label}
            {id === 'alerts' && unacknowledged > 0 && <span className="badge">{unacknowledged > 9 ? '9+' : unacknowledged}</span>}
          </button>
        ))}
      </nav>

      {settingsOpen && <SettingsPage onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
  }, []);

  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
