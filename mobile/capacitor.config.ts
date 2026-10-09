import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.surya.ops',
  appName: 'SURYA Ops',
  webDir: 'dist',
  android: {
    // The SURYA server runs on the local network over plain HTTP.
    allowMixedContent: true,
  },
  plugins: {
    // Route fetch through native HTTP: no CORS limits and works with LAN http:// servers.
    CapacitorHttp: { enabled: true },
    LocalNotifications: {
      smallIcon: 'ic_stat_surya',
      iconColor: '#4338CA',
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: '#2B2A7A',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    BackgroundRunner: {
      label: 'in.surya.ops.background',
      src: 'runners/background.js',
      event: 'checkAlerts',
      repeat: true,
      interval: 15,
      autoStart: true,
    },
  },
};

export default config;
