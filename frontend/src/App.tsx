import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { ConnectionBanner } from './components/ConnectionBanner';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Overview } from './pages/Overview';
import { DigitalTwin } from './pages/DigitalTwin';
import { Optimizer } from './pages/Optimizer';
import { Renewables } from './pages/Renewables';
import { Battery } from './pages/Battery';
import { Grid } from './pages/Grid';
import { ProtectedRoute } from './components/ProtectedRoute';
import {
  Sun,
  LayoutDashboard,
  Cpu,
  Zap,
  BatteryCharging,
  Globe,
  Activity,
  FileSpreadsheet,
  Settings as SettingsIcon,
  LogOut,
  User,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'twin'
  | 'optimizer'
  | 'renewables'
  | 'battery'
  | 'grid'
  | 'scheduler'
  | 'alerts'
  | 'reports'
  | 'settings';

const AuthenticatedApp: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  const navItems = [
    { id: 'overview', label: 'Mission Control', icon: LayoutDashboard },
    { id: 'twin', label: 'Digital Twin', icon: Cpu },
    { id: 'optimizer', label: 'Optimizer', icon: Zap },
    { id: 'renewables', label: 'Renewables', icon: Sun },
    { id: 'battery', label: 'Battery BESS', icon: BatteryCharging },
    { id: 'grid', label: 'Grid & Tariffs', icon: Globe },
    { id: 'scheduler', label: 'Scheduler & Alerts', icon: Activity },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    ...(isAdmin ? [{ id: 'settings', label: 'Settings', icon: SettingsIcon }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Platform Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-md shadow-emerald-500/20">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                <Sun className="h-5 w-5 text-amber-400" />
              </div>
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">SURYA</span>
              <span className="ml-2 hidden text-xs font-medium text-emerald-400 sm:inline-block">
                Operations Platform
              </span>
            </div>
          </div>

          {/* User Profile & Role Badges */}
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Campus Site 1 • Asia/Kolkata</span>
            </div>

            <div className="flex items-center gap-2.5 rounded-full border border-slate-800 bg-slate-800/60 px-3.5 py-1.5 text-xs text-slate-200">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span className="max-w-[140px] truncate font-medium">{user?.email}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  user?.role === 'admin'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : user?.role === 'operator'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {user?.role}
              </span>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 border-t border-slate-800/60 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as NavTab)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Connection / Staleness Banner */}
      <ConnectionBanner />

      {/* Main Content Viewport */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <ProtectedRoute requiredRole={activeTab === 'settings' ? 'admin' : 'viewer'}>
          {activeTab === 'overview' ? (
            <Overview />
          ) : activeTab === 'twin' ? (
            <DigitalTwin />
          ) : activeTab === 'optimizer' ? (
            <Optimizer />
          ) : activeTab === 'renewables' ? (
            <Renewables />
          ) : activeTab === 'battery' ? (
            <Battery />
          ) : activeTab === 'grid' ? (
            <Grid />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl backdrop-blur-sm">
              <h1 className="text-xl font-bold tracking-tight text-white capitalize">
                {activeTab.replace('_', ' ')} View
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Live data pipeline connected. Active role:{' '}
                <span className="font-semibold text-emerald-400 uppercase">{user?.role}</span>.
              </p>
            </div>
          )}
        </ProtectedRoute>
      </main>
    </div>
  );
};

const RootApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 animate-pulse shadow-lg shadow-emerald-500/20">
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
            <Sun className="h-6 w-6 text-amber-400" />
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Initializing SURYA System
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'signup') {
      return <Signup onNavigateLogin={() => setAuthView('login')} />;
    }
    return <Login onNavigateSignup={() => setAuthView('signup')} />;
  }

  return (
    <WebSocketProvider>
      <AuthenticatedApp />
    </WebSocketProvider>
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
