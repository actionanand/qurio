export const environment = {
  production: true,
  appUrl: 'https://actionanand.github.io/qurio',
  turnstile: {
    enabled: true,
    siteKey: '0x4AAAAAAE2cRVNpqHskAoyF',
  },
  androidApp: {
    promotionEnabled: true,
    webViewOrigin: 'https://localhost',
    packageName: 'com.actionanand.qurio.app',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.actionanand.qurio.app',
    deepLinkBaseUrl: 'qurio://',
    bannerAutoHideMs: 15_000,
  },
  practiceReminder: {
    enabled: true,
    defaultTime: '19:00',
    defaultDays: [1, 2, 3, 4, 5, 6, 7],
    channelId: 'qurio-practice-reminders',
    channelName: 'Practice reminders',
  },
  supabaseUrl: 'https://naurwpithhveatyaqzdd.supabase.co',
  supabaseKey: 'sb_publishable_3iI9lLJpI_8vBhP6Jk1sxg_GrMP5ZbY',
};
