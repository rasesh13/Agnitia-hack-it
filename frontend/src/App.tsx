import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConnectionStatus, WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { ConnectionBanner } from './components/ConnectionBanner';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Overview } from './pages/Overview';
import { DigitalTwin } from './pages/DigitalTwin';
import { Optimizer } from './pages/Optimizer';
import { Renewables } from './pages/Renewables';
import { Battery } from './pages/Battery';
import { Grid } from './pages/Grid';
import { Scheduler } from './pages/Scheduler';
import { Alerts } from './pages/Alerts';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Forecast } from './pages/Forecast';
import { ProtectedRoute } from './components/ProtectedRoute';
import {
  Sun,
  LayoutDashboard,
  Cpu,
  Zap,
  BatteryCharging,
  Globe,
  Activity,
  Bell,
  FileSpreadsheet,
  Settings as SettingsIcon,
  LogOut,
  User,
  LineChart,
  Home,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { SuryaMark } from '@/components/SuryaMark';

export type NavTab =
  | 'overview'
  | 'twin'
  | 'forecast'
  | 'optimizer'
  | 'renewables'
  | 'battery'
  | 'grid'
  | 'scheduler'
  | 'alerts'
  | 'reports'
  | 'settings';

interface AuthenticatedAppProps {
  onReturnToLanding?: () => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTIVE_TAB_KEY = 'surya_active_tab';

const STATUS_STYLES: Record<ConnectionStatus, { label: string; dot: string; pill: string }> = {
  connected: { label: 'Live', dot: 'bg-emerald-400', pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  connecting: { label: 'Connecting', dot: 'bg-amber-400 animate-pulse', pill: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-amber-400 animate-pulse', pill: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  disconnected: { label: 'Offline', dot: 'bg-red-400', pill: 'border-red-500/30 bg-red-500/10 text-red-300' },
  error: { label: 'Offline', dot: 'bg-red-400', pill: 'border-red-500/30 bg-red-500/10 text-red-300' },
};

const useIstClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(now);
};

const AuthenticatedApp: React.FC<AuthenticatedAppProps> = ({ onReturnToLanding }) => {
  const { user, logout, isAdmin } = useAuth();
  const { connectionStatus, isStale, activeAlerts } = useWebSocket();
  const clock = useIstClock();

  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'overview', label: 'Mission Control', icon: LayoutDashboard },
      { id: 'forecast', label: 'ML Forecasting', icon: LineChart },
      { id: 'twin', label: 'Digital Twin', icon: Cpu },
      { id: 'optimizer', label: 'Optimizer', icon: Zap },
      { id: 'renewables', label: 'Renewables', icon: Sun },
      { id: 'battery', label: 'Battery BESS', icon: BatteryCharging },
      { id: 'grid', label: 'Grid & Tariffs', icon: Globe },
      { id: 'scheduler', label: 'Scheduler', icon: Activity },
      { id: 'alerts', label: 'Alerts', icon: Bell },
      { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
      ...(isAdmin ? [{ id: 'settings' as NavTab, label: 'Settings', icon: SettingsIcon }] : []),
    ],
    [isAdmin],
  );

  const [activeTab, setActiveTab] = useState<NavTab>(() => (localStorage.getItem(ACTIVE_TAB_KEY) as NavTab | null) ?? 'overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [navFade, setNavFade] = useState({ left: false, right: false });

  // Fall back to the overview if the saved tab is unavailable (e.g. Settings for non-admins).
  const current = navItems.find((item) => item.id === activeTab) ?? navItems[0];

  const selectTab = (id: NavTab) => {
    setActiveTab(id);
    localStorage.setItem(ACTIVE_TAB_KEY, id);
    window.scrollTo({ top: 0 });
  };

  // Close the user menu on outside click.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  // On narrow screens the tab row scrolls; show edge fades and keep the active tab in view.
  const updateNavFade = () => {
    const nav = navRef.current;
    if (!nav) return;
    setNavFade({ left: nav.scrollLeft > 4, right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4 });
  };
  useEffect(() => {
    updateNavFade();
    window.addEventListener('resize', updateNavFade);
    return () => window.removeEventListener('resize', updateNavFade);
  }, [navItems]);
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current.id]);

  const status = STATUS_STYLES[connectionStatus];
  const statusLabel = connectionStatus === 'connected' && isStale ? 'Stale' : status.label;
  const alertCount = activeAlerts.length;
  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="surya-console flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Ambient glow behind the header */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_60%)]" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo & Platform Title */}
          <div className="flex items-center gap-3">
            <SuryaMark size={38} className="drop-shadow-[0_0_14px_rgba(245,158,11,0.35)]" />
            <div className="leading-tight">
              <div className="font-display text-base font-bold tracking-tight text-white">SURYA</div>
              <div className="hidden text-[11px] font-medium text-emerald-400/90 sm:block">Operations Platform</div>
            </div>
          </div>

          {/* Active site */}
          <div className="hidden items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs lg:flex">
            <span className="relative flex h-2 w-2">
              {connectionStatus === 'connected' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${status.dot}`} />
            </span>
            <span className="font-medium text-slate-200">Prestige University, Indore</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">MP Microgrid</span>
          </div>

          {/* Status, clock, alerts, user */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold sm:flex ${status.pill}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {statusLabel}
            </div>
            <div className="hidden items-center gap-1.5 text-xs font-medium tabular-nums text-slate-400 md:flex">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              {clock} IST
            </div>
            <button
              onClick={() => selectTab('alerts')}
              className="relative rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label={`Alerts${alertCount ? ` (${alertCount} active)` : ''}`}
            >
              <Bell className="h-[18px] w-[18px]" />
              {alertCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-950" />}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((value) => !value)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-2.5 transition-colors hover:border-white/20"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-[10px] font-bold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-[160px] truncate text-xs font-medium text-slate-200 md:block">{user?.email}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div role="menu" className="surya-pop absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50">
                  <div className="border-b border-white/5 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <User className="h-3.5 w-3.5" />
                      Signed in as
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-white">{user?.email}</div>
                    <span
                      className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        user?.role === 'admin'
                          ? 'border border-purple-500/30 bg-purple-500/20 text-purple-300'
                          : user?.role === 'operator'
                          ? 'border border-blue-500/30 bg-blue-500/20 text-blue-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {user?.role}
                    </span>
                  </div>
                  <div className="p-1.5">
                    {onReturnToLanding && (
                      <button
                        role="menuitem"
                        onClick={onReturnToLanding}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-amber-300"
                      >
                        <Home className="h-4 w-4" />
                        Overview Site
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          selectTab('settings');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                      >
                        <SettingsIcon className="h-4 w-4" />
                        Settings
                      </button>
                    )}
                    <button
                      role="menuitem"
                      onClick={logout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-[1600px] px-4 pb-3 sm:px-6 lg:px-8">
          <div className="relative">
            {navFade.left && <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 rounded-l-2xl bg-gradient-to-r from-slate-950 to-transparent" />}
            {navFade.right && <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 rounded-r-2xl bg-gradient-to-l from-slate-950 to-transparent" />}
            <nav
              ref={navRef}
              onScroll={updateNavFade}
              aria-label="Main navigation"
              className="surya-tabs flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = current.id === item.id;
                const badge = item.id === 'alerts' && alertCount > 0 ? alertCount : null;
                return (
                  <button
                    key={item.id}
                    onClick={() => selectTab(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35),0_8px_24px_-12px_rgba(16,185,129,0.6)]'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                    }`}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    {item.label}
                    {badge !== null && (
                      <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                    {isActive && <span className="absolute -bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      </header>

      {/* Connection / Staleness Banner */}
      <ConnectionBanner />

      {/* Main Content Viewport */}
      <main className="relative z-10 mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div key={current.id} className="surya-page">
          <ProtectedRoute requiredRole={current.id === 'settings' ? 'admin' : 'viewer'}>
            {current.id === 'overview' ? (
              <Overview />
            ) : current.id === 'forecast' ? (
              <Forecast />
            ) : current.id === 'twin' ? (
              <DigitalTwin />
            ) : current.id === 'optimizer' ? (
              <Optimizer />
            ) : current.id === 'renewables' ? (
              <Renewables />
            ) : current.id === 'battery' ? (
              <Battery />
            ) : current.id === 'grid' ? (
              <Grid />
            ) : current.id === 'scheduler' ? (
              <Scheduler />
            ) : current.id === 'alerts' ? (
              <Alerts />
            ) : current.id === 'reports' ? (
              <Reports />
            ) : current.id === 'settings' ? (
              <Settings />
            ) : (
              <Overview />
            )}
          </ProtectedRoute>
        </div>
      </main>
    </div>
  );
};


const CONSOLE_VIEW_KEY = 'surya_view';

const RootApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  // Remember that the console was open, so a page refresh does not drop a signed-in user on the landing page.
  const [viewState, setViewStateRaw] = useState<'landing' | 'login' | 'signup' | 'console'>(() =>
    sessionStorage.getItem(CONSOLE_VIEW_KEY) === 'console' ? 'console' : 'landing',
  );
  const setViewState = (next: 'landing' | 'login' | 'signup' | 'console') => {
    if (next === 'console') sessionStorage.setItem(CONSOLE_VIEW_KEY, 'console');
    else sessionStorage.removeItem(CONSOLE_VIEW_KEY);
    setViewStateRaw(next);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
        <SuryaMark size={56} className="animate-pulse drop-shadow-[0_0_24px_rgba(245,158,11,0.45)]" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Initializing SURYA System
        </p>
      </div>
    );
  }

  // If authenticated and user chose console or is active
  if (isAuthenticated && viewState !== 'landing') {
    return (
      <WebSocketProvider>
        <AuthenticatedApp onReturnToLanding={() => setViewState('landing')} />
      </WebSocketProvider>
    );
  }

  // If user selected login
  if (viewState === 'login') {
    return (
      <Login
        onNavigateSignup={() => setViewState('signup')}
        onNavigateLanding={() => setViewState('landing')}
        onSuccess={() => setViewState('console')}
      />
    );
  }

  // If user selected signup
  if (viewState === 'signup') {
    return (
      <Signup
        onNavigateLogin={() => setViewState('login')}
        onNavigateLanding={() => setViewState('landing')}
        onSuccess={() => setViewState('console')}
      />
    );
  }

  // Default: Public Landing Page
  return (
    <LandingPage
      onLaunchConsole={() => {
        if (isAuthenticated) {
          setViewState('console');
        } else {
          setViewState('login');
        }
      }}
      onLogin={() => setViewState('login')}
      onSignup={() => setViewState('signup')}
    />
  );
};

export function App() {
  return (
    <AuthProvider>
      <RootApp />
    </AuthProvider>
  );
}

export default App;

