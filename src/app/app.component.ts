import { afterNextRender, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonApp, IonSelect, IonSelectOption } from '@ionic/angular';
import { NgOptimizedImage } from '@angular/common';
import { IconComponent } from './shared/icon.component';
import { I18nService } from './core/i18n.service';
import { PreferencesService } from './core/preferences.service';
import type { Appearance } from './core/preferences.service';
import type { Language } from './core/models';
import { ProgressService } from './core/progress.service';
import { AuthService } from './services/auth.service';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { SecurityService } from './core/security.service';
import { NotificationPromptService } from './core/notification-prompt.service';
import { SnackbarComponent } from './shared/snackbar.component';
import { InstallAppBannerComponent } from './shared/install-app-banner.component';
import { AppLockComponent } from './shared/app-lock.component';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ReminderService } from './core/reminder.service';

export function navigationItems(staff: boolean) {
  return [
    { route: '/home', icon: 'book' as const, label: 'learn' as const },
    { route: '/exam-prep', icon: 'exam' as const, label: 'examPrep' as const },
    { route: '/progress', icon: 'progress' as const, label: 'progress' as const },
    { route: '/settings', icon: 'settings' as const, label: 'settings' as const },
    ...(staff ? [{ route: '/admin/users', icon: 'people' as const, label: 'admin' as const }] : []),
  ];
}
@Component({
  selector: 'app-root',
  imports: [
    IonApp,
    IonSelect,
    IonSelectOption,
    NgOptimizedImage,
    IconComponent,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SnackbarComponent,
    InstallAppBannerComponent,
    AppLockComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly i = inject(I18nService);
  readonly preferences = inject(PreferencesService);
  readonly progress = inject(ProgressService);
  readonly auth = inject(AuthService);
  private readonly security = inject(SecurityService);
  private readonly notificationPrompt = inject(NotificationPromptService);
  private readonly reminders = inject(ReminderService);
  private appStateListener?: PluginListenerHandle;
  private appUrlListener?: PluginListenerHandle;
  private notificationListener?: PluginListenerHandle;
  private readonly deviceReady = signal(false);
  readonly navigation = () => navigationItems(this.auth.isStaff());
  constructor() {
    effect(() => {
      if (!this.auth.initialized()) return;
      const userId = this.auth.user()?.id;
      void this.security
        .initialize(userId)
        .then(() => {
          if (this.security.configured()) this.security.lock();
        })
        .catch(() => undefined);
    });
    effect(() => {
      const approved = this.auth.approved();
      const ready = this.deviceReady();
      const settings = this.preferences.reminderSettings();
      if (!approved || !ready || !this.reminders.native) return;
      void this.reminders.initialize(settings).then(() => {
        if (settings.enabled && this.reminders.permissionGranted()) return this.reminders.update(settings);
        return undefined;
      });
    });
    this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(event => {
      if (event instanceof NavigationEnd)
        setTimeout(() => {
          document.getElementById('main')?.focus();
          document.getElementById('main')?.scrollTo(0, 0);
        });
    });
    afterNextRender(() => void this.initializeDeviceFeatures());
  }
  language(value: unknown) {
    if (typeof value !== 'string') return;
    if (['en', 'ta', 'hi'].includes(value)) this.preferences.language.set(value as Language);
  }
  appearance(value: unknown) {
    if (typeof value !== 'string') return;
    if (['light', 'dark', 'system'].includes(value)) this.preferences.appearance.set(value as Appearance);
  }
  private async initializeDeviceFeatures(): Promise<void> {
    await this.auth.waitUntilInitialized();
    if (Capacitor.isNativePlatform()) {
      await this.reminders.initialize(this.preferences.reminderSettings());
      this.deviceReady.set(true);
      this.appUrlListener = await App.addListener('appUrlOpen', event => void this.openNativeRoute(event.url));
      this.notificationListener = await LocalNotifications.addListener('localNotificationActionPerformed', event => {
        const route = event.notification.extra?.['route'];
        void this.router.navigateByUrl(typeof route === 'string' && route.startsWith('/') ? route : '/home');
      });
      this.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) this.security.lock();
      });
      this.destroyRef.onDestroy(() => {
        void this.appStateListener?.remove();
        void this.appUrlListener?.remove();
        void this.notificationListener?.remove();
      });
      await this.notificationPrompt.promptOnce();
    }
  }

  private async openNativeRoute(url: string): Promise<void> {
    try {
      const parsed = new URL(url);
      const route = `/${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '') || '/home';
      await this.router.navigateByUrl(route === '/home' ? route : '/home');
    } catch {
      await this.router.navigateByUrl('/home');
    }
  }
}
