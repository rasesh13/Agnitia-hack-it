import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { storage } from './storage';
import type { AlertItem, AppSettings } from './types';

const native = Capacitor.isNativePlatform();

export const CHANNELS = {
  critical: 'surya-critical',
  warning: 'surya-warning',
  updates: 'surya-updates',
};

export async function setupNotifications() {
  if (!native) return;
  await LocalNotifications.createChannel({
    id: CHANNELS.critical,
    name: 'Critical alerts',
    description: 'Battery floor, emergency stop, failed equipment',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#F43F5E',
  });
  await LocalNotifications.createChannel({
    id: CHANNELS.warning,
    name: 'Warnings',
    description: 'Low battery, high grid import, stale telemetry',
    importance: 4,
    visibility: 1,
    vibration: true,
  });
  await LocalNotifications.createChannel({
    id: CHANNELS.updates,
    name: 'Updates',
    description: 'Resolved alerts and test notifications',
    importance: 3,
    visibility: 1,
  });
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!native) return 'unsupported';
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
}

export async function requestNotificationPermission() {
  if (!native) return 'unsupported' as const;
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted' ? ('granted' as const) : ('denied' as const);
}

/** Shows the system permission dialog once per install; later prompts come from the in-app banner. */
export async function askNotificationsOnce() {
  const status = await notificationPermission();
  if (status === 'granted' || status === 'unsupported' || (await storage.notificationsAsked())) return status;
  await storage.markNotificationsAsked();
  return requestNotificationPermission();
}

// Stable 31-bit id per alert key so an update replaces rather than duplicates.
const idFor = (key: string) => {
  let hash = 7;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 2_000_000_000;
};

export async function notifyAlerts(opened: AlertItem[], resolved: AlertItem[], settings: AppSettings) {
  if (!native || !settings.notifications) return;
  const items = [
    ...opened
      .filter((alert) => alert.severity === 'critical' || settings.notifyWarnings)
      .map((alert) => ({
        id: idFor(alert.key),
        title: `${alert.severity === 'critical' ? '🔴' : '🟠'} ${alert.title}`,
        body: alert.body,
        largeBody: alert.body,
        summaryText: 'Prestige University microgrid',
        channelId: alert.severity === 'critical' ? CHANNELS.critical : CHANNELS.warning,
        smallIcon: 'ic_stat_surya',
        // Immediate notifications: no exact-alarm permission (and no settings detour) needed.
        isExactNotification: false,
        group: 'surya-alerts',
        extra: { key: alert.key, tab: 'alerts' },
      })),
    ...(settings.notifyResolved
      ? resolved.map((alert) => ({
          id: idFor(alert.key),
          title: `✅ Resolved: ${alert.title}`,
          body: 'The condition has cleared.',
          channelId: CHANNELS.updates,
          smallIcon: 'ic_stat_surya',
          isExactNotification: false,
          group: 'surya-alerts',
          extra: { key: alert.key, tab: 'alerts' },
        }))
      : []),
  ];
  if (items.length) await LocalNotifications.schedule({ notifications: items });
}

export async function sendTestNotification() {
  if (!native) return false;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 4242,
        title: '☀️ SURYA notifications are on',
        body: 'You will be alerted here about battery, grid, equipment and safety events.',
        channelId: CHANNELS.updates,
        smallIcon: 'ic_stat_surya',
        isExactNotification: false,
        extra: { tab: 'alerts' },
      },
    ],
  });
  return true;
}
