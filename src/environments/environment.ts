// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  appUrl: 'http://localhost:3039',
  androidApp: {
    promotionEnabled: false,
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

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
