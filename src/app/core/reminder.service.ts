import { Service, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Weekday, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { environment } from '../../environments/environment';

export interface PracticeReminderSettings {
  enabled: boolean;
  time: string;
  days: number[];
}

const firstNotificationId = 7401;

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
    await LocalNotifications.createChannel({
      id: environment.practiceReminder.channelId,
      name: environment.practiceReminder.channelName,
      description: 'Reminders to practise with Qurio',
      importance: 3,
      visibility: 0,
    });
    this.permission.set((await LocalNotifications.checkPermissions()).display);
  }

  permissionGranted(): boolean {
    return this.permission() === 'granted';
  }

  async requestPermission(): Promise<boolean> {
    if (!this.native) return false;
    const result = await LocalNotifications.requestPermissions();
    this.permission.set(result.display);
    return result.display === 'granted';
  }

  async update(next: PracticeReminderSettings): Promise<boolean> {
    const normalized = normalizeSettings(next);
    if (normalized.enabled && (!normalized.days.length || !this.permissionGranted())) return false;
    if (this.native) {
      await this.cancel();
      if (normalized.enabled) {
        const [hour, minute] = normalized.time.split(':').map(Number);
        const notifications: LocalNotificationSchema[] = normalized.days.map(day => ({
          id: notificationId(day),
          title: 'Qurio practice time',
          body: 'Ready for a quick learning session?',
          channelId: environment.practiceReminder.channelId,
          extra: { route: '/home', kind: 'practice-reminder' },
          schedule: {
            on: { weekday: appDayToPluginWeekday(day), hour, minute },
            repeats: true,
            allowWhileIdle: true,
            isExactNotification: false,
          },
        }));
        await LocalNotifications.schedule({ notifications });
      }
    }
    this.settings.set(normalized);
    return true;
  }

  async cancel(): Promise<void> {
    if (!this.native) return;
    await LocalNotifications.cancel({
      notifications: environment.practiceReminder.defaultDays.map(day => ({ id: notificationId(day) })),
    });
  }
}

export function appDayToPluginWeekday(day: number): Weekday {
  return (day === 7 ? Weekday.Sunday : day + 1) as Weekday;
}

export function notificationId(day: number): number {
  return firstNotificationId + day - 1;
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
