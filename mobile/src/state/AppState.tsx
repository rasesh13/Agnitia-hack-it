import { App as CapApp } from '@capacitor/app';
import { BackgroundRunner } from '@capacitor/background-runner';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { evaluate, merge, openConnectionAlert } from '../lib/alerts';
import { api, ApiError } from '../lib/api';
import { notifyAlerts, setupNotifications } from '../lib/notify';
import { storage } from '../lib/storage';
import { DEFAULT_SETTINGS } from '../lib/types';
import type { AlertItem, AppSettings, Session, Snapshot } from '../lib/types';

export type Tab = 'home' | 'alerts' | 'energy' | 'insights' | 'control';

interface AppState {
  ready: boolean;
  session: Session | null;
  settings: AppSettings;
  snapshot: Snapshot | null;
  alerts: AlertItem[];
  activeAlerts: AlertItem[];
  unacknowledged: number;
  online: boolean;
  lastError: string | null;
  refreshing: boolean;
  tab: Tab;
  setTab: (tab: Tab) => void;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  acknowledge: (key: string) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);
const RUNNER_LABEL = 'in.surya.ops.background';
const OFFLINE_AFTER_FAILURES = 3;

/** Hands connection details to the background runner so it can check while the app is closed. */
async function syncBackground(session: Session | null, settings: AppSettings, alerts: AlertItem[]) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await BackgroundRunner.dispatchEvent({
      label: RUNNER_LABEL,
      event: 'syncConfig',
      details: {
        serverUrl: session && !session.demo ? session.serverUrl : '',
        token: session && !session.demo ? session.token : '',
        settings,
        activeKeys: alerts.filter((alert) => alert.resolvedAt === null).map((alert) => alert.key),
      },
    });
  } catch {
    // Background checks are best-effort; the foreground app keeps working without them.
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [online, setOnline] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [foreground, setForeground] = useState(true);

  // Refs keep the polling loop reading current values without re-creating timers.
  const alertsRef = useRef(alerts);
  const settingsRef = useRef(settings);
  const sessionRef = useRef(session);
  const failures = useRef(0);
  const inFlight = useRef(false);
  alertsRef.current = alerts;
  settingsRef.current = settings;
  sessionRef.current = session;

  const commitAlerts = useCallback(async (next: AlertItem[]) => {
    alertsRef.current = next;
    setAlerts(next);
    await storage.saveAlerts(next);
  }, []);

  useEffect(() => {
    (async () => {
      await setupNotifications();
      const [savedSession, savedSettings, savedAlerts] = await Promise.all([
        storage.loadSession(),
        storage.loadSettings(),
        storage.loadAlerts(),
      ]);
      setSettings(savedSettings);
      setAlerts(savedAlerts);
      setSession(savedSession);
      setReady(true);
    })();
  }, []);

  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const next = await api.snapshot(current);
      failures.current = 0;
      setSnapshot(next);
      setOnline(true);
      setLastError(null);
      const result = merge(alertsRef.current, evaluate(next, settingsRef.current));
      await commitAlerts(result.alerts);
      await notifyAlerts(result.opened, result.resolved, settingsRef.current);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 401) {
        setLastError('Your session expired. Please sign in again.');
        await storage.clearSession();
        setSession(null);
        setSnapshot(null);
        return;
      }
      failures.current += 1;
      setLastError(apiError.message);
      if (failures.current >= OFFLINE_AFTER_FAILURES) {
        setOnline(false);
        const result = openConnectionAlert(alertsRef.current, apiError.message);
        if (result.opened.length) {
          await commitAlerts(result.alerts);
          await notifyAlerts(result.opened, [], settingsRef.current);
        }
      }
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [commitAlerts]);

  // Poll while signed in and in the foreground; pause in the background to save battery.
  useEffect(() => {
    if (!session || !foreground) return undefined;
    refresh();
    const timer = window.setInterval(refresh, Math.max(5, settings.refreshSeconds) * 1000);
    return () => window.clearInterval(timer);
  }, [session, foreground, settings.refreshSeconds, refresh]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const subscriptions = [
      CapApp.addListener('appStateChange', ({ isActive }) => {
        setForeground(isActive);
        if (!isActive) syncBackground(sessionRef.current, settingsRef.current, alertsRef.current);
      }),
      LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        if (event.notification.extra?.tab === 'alerts') setTab('alerts');
      }),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.then((handle) => handle.remove()));
    };
  }, []);

  useEffect(() => {
    syncBackground(session, settings, alertsRef.current);
  }, [session, settings]);

  const signIn = useCallback(async (next: Session) => {
    await storage.saveSession(next);
    if (!next.demo) await storage.rememberServer(next.serverUrl);
    failures.current = 0;
    setOnline(true);
    setLastError(null);
    setSnapshot(null);
    setTab('home');
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await storage.clearSession();
    setSession(null);
    setSnapshot(null);
    await syncBackground(null, settingsRef.current, []);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    await storage.saveSettings(next);
  }, []);

  const acknowledge = useCallback(
    async (key: string) => {
      const now = Date.now();
      await commitAlerts(alertsRef.current.map((alert) => (alert.key === key && alert.resolvedAt === null ? { ...alert, acknowledgedAt: now } : alert)));
    },
    [commitAlerts],
  );

  const acknowledgeAll = useCallback(async () => {
    const now = Date.now();
    await commitAlerts(alertsRef.current.map((alert) => (alert.resolvedAt === null && !alert.acknowledgedAt ? { ...alert, acknowledgedAt: now } : alert)));
  }, [commitAlerts]);

  const clearHistory = useCallback(async () => {
    await commitAlerts(alertsRef.current.filter((alert) => alert.resolvedAt === null));
  }, [commitAlerts]);

  const value = useMemo<AppState>(() => {
    const activeAlerts = alerts.filter((alert) => alert.resolvedAt === null);
    return {
      ready,
      session,
      settings,
      snapshot,
      alerts,
      activeAlerts,
      unacknowledged: activeAlerts.filter((alert) => !alert.acknowledgedAt).length,
      online,
      lastError,
      refreshing,
      tab,
      setTab,
      signIn,
      signOut,
      refresh,
      updateSettings,
      acknowledge,
      acknowledgeAll,
      clearHistory,
    };
  }, [ready, session, settings, snapshot, alerts, online, lastError, refreshing, tab, signIn, signOut, refresh, updateSettings, acknowledge, acknowledgeAll, clearHistory]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const context = useContext(Ctx);
  if (!context) throw new Error('useApp must be used inside AppStateProvider');
  return context;
}
