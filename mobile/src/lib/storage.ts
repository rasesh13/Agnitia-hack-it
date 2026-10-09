import { Preferences } from '@capacitor/preferences';
import { DEFAULT_SETTINGS } from './types';
import type { AlertItem, AppSettings, Session } from './types';

const KEYS = {
  session: 'surya.session',
  settings: 'surya.settings',
  alerts: 'surya.alerts',
  lastServer: 'surya.lastServer',
  onboarded: 'surya.onboarded',
  notificationsAsked: 'surya.notificationsAsked',
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const { value } = await Preferences.get({ key });
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const writeJson = (key: string, value: unknown) => Preferences.set({ key, value: JSON.stringify(value) });

// The old default backend on the operator's PC. Sessions and saved servers that
// point at it are dropped so the app moves to the hosted backend.
const LEGACY_SERVER = 'http://172.10.21.55:8010';

export const storage = {
  loadSession: async () => {
    const session = await readJson<Session | null>(KEYS.session, null);
    if (session?.serverUrl !== LEGACY_SERVER) return session;
    await Preferences.remove({ key: KEYS.session });
    return null;
  },
  saveSession: (session: Session) => writeJson(KEYS.session, session),
  clearSession: () => Preferences.remove({ key: KEYS.session }),

  loadSettings: async () => ({ ...DEFAULT_SETTINGS, ...(await readJson<Partial<AppSettings>>(KEYS.settings, {})) }),
  saveSettings: (settings: AppSettings) => writeJson(KEYS.settings, settings),

  loadAlerts: () => readJson<AlertItem[]>(KEYS.alerts, []),
  saveAlerts: (alerts: AlertItem[]) => writeJson(KEYS.alerts, alerts),

  lastServer: async () => {
    const { value } = await Preferences.get({ key: KEYS.lastServer });
    return value === LEGACY_SERVER ? null : value;
  },
  rememberServer: (url: string) => Preferences.set({ key: KEYS.lastServer, value: url }),

  isOnboarded: async () => (await Preferences.get({ key: KEYS.onboarded })).value === '1',
  markOnboarded: () => Preferences.set({ key: KEYS.onboarded, value: '1' }),

  notificationsAsked: async () => (await Preferences.get({ key: KEYS.notificationsAsked })).value === '1',
  markNotificationsAsked: () => Preferences.set({ key: KEYS.notificationsAsked, value: '1' }),
};
