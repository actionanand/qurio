import { beforeEach, describe, expect, it, vi } from 'vitest';

const notifications = vi.hoisted(() => ({
  createChannel: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: notifications,
  Weekday: { Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 6, Saturday: 7 },
}));

import { ReminderService, notificationId } from './reminder.service';

describe('ReminderService', () => {
  let nativeBridge: QurioNativeBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    nativeBridge = {
      notificationPermissionGranted: () => true,
      requestNotificationPermission: () => undefined,
    };
    window.QurioNative = nativeBridge;
    notifications.createChannel.mockResolvedValue(undefined);
    notifications.cancel.mockResolvedValue(undefined);
    notifications.schedule.mockResolvedValue(undefined);
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
    expect(notifications.checkPermissions).not.toHaveBeenCalled();
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
  });

  it('cancels its reserved IDs and schedules only selected weekdays in local time', async () => {
    const service = new ReminderService();
    await service.initialize();
    expect(await service.update({ enabled: true, time: '19:25', days: [1, 7] })).toBe(true);
    expect(notifications.cancel).toHaveBeenCalled();
    const scheduled = notifications.schedule.mock.calls[0][0].notifications;
    expect(scheduled.map((item: { id: number }) => item.id)).toEqual([notificationId(1), notificationId(7)]);
    expect(scheduled.map((item: { schedule: { on: unknown } }) => item.schedule.on)).toEqual([
      { weekday: 2, hour: 19, minute: 25 },
      { weekday: 1, hour: 19, minute: 25 },
    ]);
  });

  it('reschedules by cancelling first and cancellation covers every reserved ID', async () => {
    const service = new ReminderService();
    await service.initialize();
    await service.update({ enabled: true, time: '18:00', days: [3] });
    await service.update({ enabled: true, time: '20:00', days: [4] });
    expect(notifications.cancel).toHaveBeenCalledTimes(2);
    await service.cancel();
    const ids = notifications.cancel.mock.calls.at(-1)?.[0].notifications.map((item: { id: number }) => item.id);
    expect(ids).toEqual([7401, 7402, 7403, 7404, 7405, 7406, 7407]);
  });
});
