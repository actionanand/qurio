import { InjectionToken, Service, inject } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

type NativeSaveStatus = 'saved' | 'cancelled' | 'unavailable' | 'error';
type NativeGetStatus = 'success' | 'cancelled' | 'not-found' | 'unavailable' | 'error';

export interface QurioCredentialsPlugin {
  savePassword(options: { email: string; password: string }): Promise<{ status: NativeSaveStatus }>;
  getPassword(): Promise<{ status: NativeGetStatus; email?: string; password?: string }>;
}

export type PasswordLookupResult =
  | { status: 'success'; email: string; password: string }
  | { status: 'cancelled' | 'not-found' | 'unavailable' | 'error' };

export const QURIO_CREDENTIALS = new InjectionToken<QurioCredentialsPlugin>('QurioCredentialsPlugin', {
  factory: () => registerPlugin<QurioCredentialsPlugin>('QurioCredentials'),
});

@Service()
export class CredentialManagerService {
  private readonly credentials = inject(QURIO_CREDENTIALS);
  readonly native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  async savePassword(email: string, password: string): Promise<void> {
    if (!this.native) return;
    try {
      await this.credentials.savePassword({ email, password });
    } catch {
      // Password Manager is optional and must never block a successful sign-in.
    }
  }

  async getPassword(): Promise<PasswordLookupResult> {
    if (!this.native) return { status: 'unavailable' };
    try {
      const result = await this.credentials.getPassword();
      if (result.status !== 'success') return { status: result.status };
      if (!result.email || !result.password) return { status: 'error' };
      return { status: 'success', email: result.email, password: result.password };
    } catch {
      return { status: 'error' };
    }
  }
}
