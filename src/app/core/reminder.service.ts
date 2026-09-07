import { Service, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

export interface PracticeReminderSettings {
  enabled: boolean;
  time: string;
  days: number[];
}

const storageKey = 'qurio.practiceReminder.v1';
const defaults: PracticeReminderSettings = { enabled: false, time: '18:00', days: [2, 3, 4, 5, 6] };

@Service()
export class ReminderService {
  readonly native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  readonly settings = signal(this.read());

  permissionGranted(): boolean {
    return this.native && (window.QurioNative?.notificationPermissionGranted?.() ?? false);
  }

  async requestPermission(): Promise<boolean> {
    if (!this.native || !window.QurioNative?.requestNotificationPermission) return false;
    if (this.permissionGranted()) return true;
    const result = this.nativeResult('notification-permission');
    window.QurioNative.requestNotificationPermission();
    return (await result).data === 'granted';
  }

  async update(next: PracticeReminderSettings): Promise<boolean> {
    const normalized = { ...next, days: [...new Set(next.days)].sort((a, b) => a - b) };
    if (normalized.enabled && (!normalized.days.length || !this.permissionGranted())) return false;
    if (normalized.enabled) {
      if (!window.QurioNative?.scheduleReminder) return false;
      const [hour, minute] = normalized.time.split(':').map(Number);
      const result = this.nativeResult('reminder-schedule');
      window.QurioNative.scheduleReminder(hour, minute, normalized.days.join(','));
      if (!(await result).success) return false;
    } else {
      window.QurioNative?.cancelReminder?.();
    }
    this.settings.set(normalized);
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalized));
    } catch {
      return true;
    }
    return true;
  }

  private read(): PracticeReminderSettings {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (!value || typeof value !== 'object') return defaults;
      const candidate = value as Partial<PracticeReminderSettings>;
      return {
        enabled: candidate.enabled === true,
        time:
          typeof candidate.time === 'string' && /^\d{2}:\d{2}$/.test(candidate.time) ? candidate.time : defaults.time,
        days:
          Array.isArray(candidate.days) && candidate.days.every(day => Number.isInteger(day) && day >= 1 && day <= 7)
            ? candidate.days
            : defaults.days,
      };
    } catch {
      return defaults;
    }
  }

  private nativeResult(action: string, timeoutMs = 60_000): Promise<QurioNativeResult> {
    return new Promise(resolve => {
      const fallback: QurioNativeResult = { action, success: false, data: '', message: 'Request timed out' };
      const timer = setTimeout(() => finish(fallback), timeoutMs);
      const listener = (event: Event) => {
        const detail = (event as CustomEvent<QurioNativeResult>).detail;
        if (detail.action === action) finish(detail);
      };
      const finish = (result: QurioNativeResult) => {
        clearTimeout(timer);
        window.removeEventListener('qurio-native-result', listener);
        resolve(result);
      };
      window.addEventListener('qurio-native-result', listener);
    });
  }
}
