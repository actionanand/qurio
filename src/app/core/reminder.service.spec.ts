import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }));

import { appDayToCalendarDay, ReminderService } from './reminder.service';

describe('ReminderService', () => {
  let nativeBridge: QurioNativeBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    nativeBridge = {
      notificationPermissionGranted: () => true,
      requestNotificationPermission: () => undefined,
      scheduleReminder: () => undefined,
      cancelReminder: () => undefined,
    };
    window.QurioNative = nativeBridge;
  });

  it('detects native Android and reflects allowed or denied permission', async () => {
    const service = new ReminderService();
    expect(service.native).toBe(true);
    await service.initialize();
    expect(service.permissionGranted()).toBe(true);
    nativeBridge.notificationPermissionGranted = () => false;
    nativeBridge.requestNotificationPermission = () => {
      window.dispatchEvent(
        new CustomEvent('qurio-native-result', {
          detail: { action: 'notification-permission', success: true, data: 'denied', message: '' },
        }),
      );
    };
    expect(await service.requestPermission()).toBe(false);
    expect(service.permission()).toBe('denied');
  });

  it('schedules selected weekdays through the guarded native Android bridge', async () => {
    nativeBridge.scheduleReminder = (hour, minute, days) => {
      window.dispatchEvent(
        new CustomEvent('qurio-native-result', {
          detail: { action: 'reminder-schedule', success: true, data: '', message: '' },
        }),
      );
      expect([hour, minute, days]).toEqual([19, 25, '2,1']);
    };
    const service = new ReminderService();
    await service.initialize();
    expect(await service.update({ enabled: true, time: '19:25', days: [1, 7] })).toBe(true);
  });

  it('cancels through the native bridge when reminders are disabled', async () => {
    nativeBridge.cancelReminder = () => {
      window.dispatchEvent(
        new CustomEvent('qurio-native-result', {
          detail: { action: 'reminder-cancel', success: true, data: '', message: '' },
        }),
      );
    };
    const service = new ReminderService();
    await service.initialize();
    await service.cancel();
  });

  it('converts Monday through Sunday to Android Calendar weekday values', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(appDayToCalendarDay)).toEqual([2, 3, 4, 5, 6, 7, 1]);
  });
});
