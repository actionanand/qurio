import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.actionanand.qurio.app',
  appName: 'Qurio',
  webDir: 'www',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#f3f7f1' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1_500,
      backgroundColor: '#f3f7f1',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
      splashFullScreen: true,
      splashImmersive: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_qurio',
      iconColor: '#176B4A',
    },
  },
};

export default config;
