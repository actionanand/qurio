import { Service, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';

export interface PracticeReminderSettings {
  enabled: boolean;
  time: string;
  days: number[];
}

@Service()
export class ReminderService {
  readonly native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  readonly permission = signal<'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unavailable'>(
    'unavailable',
  );
  readonly settings = signal<PracticeReminderSettings>({
    enabled: false,
    time: environment.practiceReminder.defaultTime,
    days: [...environment.practiceReminder.defaultDays],
  });

  async initialize(settings?: PracticeReminderSettings): Promise<void> {
    if (settings) this.settings.set(normalizeSettings(settings));
    if (!this.native || !environment.practiceReminder.enabled) return;
    this.refreshPermission();
  }

  permissionGranted(): boolean {
    return this.permission() === 'granted';
  }

  async requestPermission(): Promise<boolean> {
    if (!this.native || !window.QurioNative?.requestNotificationPermission) return false;
    if (this.refreshPermission()) return true;
    try {
      const result = await this.nativeResult('notification-permission', () =>
        window.QurioNative?.requestNotificationPermission?.(),
      );
      const granted = result.success && result.data === 'granted';
      this.permission.set(granted ? 'granted' : 'denied');
      return granted;
    } catch {
      this.permission.set('denied');
      return false;
    }
  }

  async update(next: PracticeReminderSettings): Promise<boolean> {
    const normalized = normalizeSettings(next);
    if (normalized.enabled && (!normalized.days.length || !this.permissionGranted())) return false;
    if (this.native) {
      const bridge = window.QurioNative;
      if (!bridge) return false;
      if (normalized.enabled && !bridge.scheduleReminder) return false;
      if (!normalized.enabled && !bridge.cancelReminder) return false;
      const action = normalized.enabled ? 'reminder-schedule' : 'reminder-cancel';
      const result = await this.nativeResult(action, () => {
        if (!normalized.enabled) bridge.cancelReminder?.();
        else {
          const [hour, minute] = normalized.time.split(':').map(Number);
          bridge.scheduleReminder?.(hour, minute, normalized.days.map(appDayToCalendarDay).join(','));
        }
      });
      if (!result.success) return false;
    }
    this.settings.set(normalized);
    return true;
  }

  async cancel(): Promise<void> {
    if (!this.native) return;
    const bridge = window.QurioNative;
    if (!bridge?.cancelReminder) return;
    await this.nativeResult('reminder-cancel', () => bridge.cancelReminder?.());
  }

  private refreshPermission(): boolean {
    const granted = window.QurioNative?.notificationPermissionGranted?.() ?? false;
    this.permission.set(granted ? 'granted' : 'prompt');
    return granted;
  }

  private nativeResult(action: string, start: () => void, timeoutMs = 60_000): Promise<QurioNativeResult> {
    return new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = (result?: QurioNativeResult, error?: Error): void => {
        if (timeout) clearTimeout(timeout);
        window.removeEventListener('qurio-native-result', listener);
        if (result) resolve(result);
        else reject(error ?? new Error('The Android request could not be completed.'));
      };
      const listener = (event: Event): void => {
        const detail = (event as CustomEvent<QurioNativeResult>).detail;
        if (detail.action !== action) return;
        finish(detail);
      };
      window.addEventListener('qurio-native-result', listener);
      timeout = setTimeout(() => finish(undefined, new Error('The Android request timed out.')), timeoutMs);
      try {
        start();
      } catch (error) {
        finish(undefined, error instanceof Error ? error : new Error('The Android request could not be started.'));
      }
    });
  }
}

export function appDayToCalendarDay(day: number): number {
  return day === 7 ? 1 : day + 1;
}

function normalizeSettings(settings: PracticeReminderSettings): PracticeReminderSettings {
  return {
    enabled: settings.enabled,
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.time) ? settings.time : environment.practiceReminder.defaultTime,
    days: [...new Set(settings.days.filter(day => Number.isInteger(day) && day >= 1 && day <= 7))].sort(
      (a, b) => a - b,
    ),
  };
}
