import { Service, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

interface LockRecord {
  key: string;
  enabled: true;
  salt: string;
  verifier: string;
  biometric: boolean;
}

@Service()
export class SecurityService {
  readonly configured = signal(false);
  readonly unlocked = signal(true);
  readonly biometricEnabled = signal(false);
  readonly biometricAvailable = signal(false);
  readonly native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  private database?: IDBDatabase;
  private record?: LockRecord;
  private userId?: string;

  async initialize(userId?: string): Promise<void> {
    if (!userId) {
      this.clearState();
      return;
    }
    if (!this.database) this.database = await this.openDatabase();
    if (this.userId === userId) return;
    this.userId = userId;
    this.record = await this.request(this.store('readonly').get(this.key()));
    this.configured.set(this.record?.enabled ?? false);
    this.biometricEnabled.set(this.record?.biometric ?? false);
    this.biometricAvailable.set(this.native && (window.QurioNative?.isBiometricAvailable?.() ?? false));
    this.unlocked.set(!this.configured());
  }

  async setPin(pin: string): Promise<void> {
    if (!this.userId || !/^\d{4,8}$/.test(pin)) throw new Error('invalid-pin');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    window.QurioNative?.disableBiometric?.();
    const record: LockRecord = {
      key: this.key(),
      enabled: true,
      salt: this.base64(salt),
      verifier: await this.verifier(pin, salt),
      biometric: false,
    };
    await this.request(this.store('readwrite').put(record));
    this.record = record;
    this.configured.set(true);
    this.unlocked.set(true);
    this.biometricEnabled.set(false);
  }

  async verify(pin: string): Promise<boolean> {
    if (!this.record) return false;
    const candidate = await this.verifier(pin, this.bytes(this.record.salt));
    const valid = this.constantTime(candidate, this.record.verifier);
    if (valid) this.unlocked.set(true);
    return valid;
  }

  async disable(pin: string): Promise<boolean> {
    if (!(await this.verify(pin))) return false;
    await this.request(this.store('readwrite').delete(this.key()));
    window.QurioNative?.disableBiometric?.();
    this.record = undefined;
    this.configured.set(false);
    this.biometricEnabled.set(false);
    this.unlocked.set(true);
    return true;
  }

  lock(): void {
    if (this.configured()) this.unlocked.set(false);
  }

  async enableBiometric(pin: string): Promise<boolean> {
    if (!this.record || !this.biometricAvailable() || !(await this.verify(pin)) || !window.QurioNative?.enableBiometric)
      return false;
    const pending = this.nativeResult('biometric-enabled');
    window.QurioNative.enableBiometric(pin);
    if (!(await pending).success) return false;
    this.record = { ...this.record, biometric: true };
    await this.request(this.store('readwrite').put(this.record));
    this.biometricEnabled.set(true);
    return true;
  }

  async authenticateBiometric(): Promise<boolean> {
    if (!this.biometricEnabled() || !window.QurioNative?.authenticateBiometric) return false;
    const pending = this.nativeResult('biometric-unlock');
    window.QurioNative.authenticateBiometric();
    const result = await pending;
    return result.success ? this.verify(result.data) : false;
  }

  private clearState(): void {
    this.userId = undefined;
    this.record = undefined;
    this.configured.set(false);
    this.biometricEnabled.set(false);
    this.unlocked.set(true);
  }

  private key(): string {
    if (!this.userId) throw new Error('Security profile is unavailable.');
    return `lock:${this.userId}`;
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('qurio-security', 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => request.result.createObjectStore('security', { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
    });
  }

  private store(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.database) throw new Error('Security storage is unavailable.');
    return this.database.transaction('security', mode).objectStore('security');
  }

  private async verifier(pin: string, salt: Uint8Array): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt).buffer, iterations: 310_000 },
      key,
      256,
    );
    return this.base64(new Uint8Array(bits));
  }

  private constantTime(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
  }

  private base64(value: Uint8Array): string {
    return btoa(String.fromCharCode(...value));
  }

  private bytes(value: string): Uint8Array {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private nativeResult(action: string, timeoutMs = 60_000): Promise<QurioNativeResult> {
    return new Promise(resolve => {
      const timer = setTimeout(
        () => finish({ action, success: false, data: '', message: 'Request timed out' }),
        timeoutMs,
      );
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
