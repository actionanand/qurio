import { beforeEach, describe, expect, it } from 'vitest';
import { SecurityService } from './security.service';

interface FakeRequest<T> {
  result: T;
  error: null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded?: (() => void) | null;
}

describe('SecurityService', () => {
  beforeEach(() => {
    const records = new Map<string, unknown>();
    const request = <T>(result: T): IDBRequest<T> => {
      const value: FakeRequest<T> = { result, error: null, onsuccess: null, onerror: null };
      queueMicrotask(() => value.onsuccess?.());
      return value as unknown as IDBRequest<T>;
    };
    const store = {
      get: (key: string) => request(records.get(key)),
      put: (value: { key: string }) => {
        records.set(value.key, value);
        return request(value.key);
      },
      delete: (key: string) => {
        records.delete(key);
        return request(undefined);
      },
    };
    const database = { transaction: () => ({ objectStore: () => store }) } as unknown as IDBDatabase;
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        open: () => {
          const openRequest: FakeRequest<IDBDatabase> = {
            result: database,
            error: null,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
          };
          queueMicrotask(() => {
            openRequest.onupgradeneeded?.();
            openRequest.onsuccess?.();
          });
          return openRequest as unknown as IDBOpenDBRequest;
        },
      },
    });
    (database as unknown as { createObjectStore: () => void }).createObjectStore = () => undefined;
  });

  it('sets, locks, verifies, rejects a wrong PIN, and disables the lock', async () => {
    const service = new SecurityService();
    await service.initialize('user-a');
    await service.setPin('2468');
    expect(service.configured()).toBe(true);
    service.lock();
    expect(service.unlocked()).toBe(false);
    expect(await service.verify('1111')).toBe(false);
    expect(await service.verify('2468')).toBe(true);
    expect(await service.disable('2468')).toBe(true);
    expect(service.configured()).toBe(false);
  });

  it('isolates PIN records by user ID', async () => {
    const service = new SecurityService();
    await service.initialize('user-a');
    await service.setPin('2468');
    await service.initialize('user-b');
    expect(service.configured()).toBe(false);
    await service.setPin('1357');
    await service.initialize('user-a');
    expect(await service.verify('2468')).toBe(true);
    expect(await service.verify('1357')).toBe(false);
  });

  it('removes the deleted user PIN record without affecting another user', async () => {
    const service = new SecurityService();
    await service.initialize('user-a');
    await service.setPin('2468');
    await service.initialize('user-b');
    await service.setPin('1357');

    await service.clearUser('user-a');

    await service.initialize('user-a');
    expect(service.configured()).toBe(false);
    await service.initialize('user-b');
    expect(await service.verify('1357')).toBe(true);
  });
});
