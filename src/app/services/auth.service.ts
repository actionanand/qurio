import { Service, computed, inject, signal } from '@angular/core';
import type { EmailOtpType, Session, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { CaptchaService } from '../auth/captcha.service';
import { SecurityService } from '../core/security.service';
import type { AccountStatus, AppRole, UserProfile } from './auth.models';
import { SupabaseService } from './supabase.service';

@Service()
export class AuthService {
  private readonly captcha = inject(CaptchaService);
  private readonly security = inject(SecurityService);
  private readonly supabase = inject(SupabaseService).client;
  private profileRequest?: Promise<UserProfile | null>;
  private initializationRequest?: Promise<void>;
  readonly session = signal<Session | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly initialized = signal(false);
  readonly loading = signal(true);
  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly authenticated = computed(() => !!this.user());
  readonly emailVerified = computed(() => !!this.profile()?.email_verified_at);
  readonly accountStatus = computed<AccountStatus | null>(() => this.profile()?.status ?? null);
  readonly role = computed<AppRole | null>(() => this.profile()?.role ?? null);
  readonly approved = computed(() => this.accountStatus() === 'approved');
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isOwner = computed(() => this.role() === 'owner');
  readonly isStaff = computed(() => this.approved() && (this.isAdmin() || this.isOwner()));

  constructor() {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      if (!session) this.profile.set(null);
      queueMicrotask(() => void this.synchronizeProfile(session));
    });
    void this.initialize();
  }

  initialize(): Promise<void> {
    if (this.initialized()) return Promise.resolve();
    this.initializationRequest ??= this.performInitialization();
    return this.initializationRequest;
  }

  private async performInitialization(): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.supabase.auth.getSession();
    if (error) console.warn('Unable to restore the Qurio session.');
    this.session.set(data.session);
    await this.synchronizeProfile(data.session);
    this.initialized.set(true);
    this.loading.set(false);
  }

  async waitUntilInitialized(): Promise<void> {
    if (this.initialized()) return;
    await this.initialize();
  }

  async signUp(name: string, email: string, password: string, captchaToken: string) {
    const token = this.requireCaptchaToken(captchaToken);
    return this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${environment.appUrl}/auth/callback`,
        captchaToken: token,
      },
    });
  }

  async signIn(email: string, password: string, captchaToken: string) {
    const token = this.requireCaptchaToken(captchaToken);
    const result = await this.supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: token },
    });
    if (!result.error) {
      this.session.set(result.data.session);
      await this.refreshProfile();
    }
    return result;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
  }

  async deleteMyAccount(confirmationEmail: string): Promise<void> {
    const userId = this.user()?.id;
    if (!userId) throw new Error('Authentication is required');
    const { data, error } = await this.supabase.functions.invoke('delete-my-account', { body: { confirmationEmail } });
    if (error) throw error;
    if (!data || typeof data !== 'object' || 'error' in data)
      throw new Error(String((data as { error?: string })?.error));
    try {
      await this.security.clearUser(userId);
    } catch {
      // The remote account is already deleted; local session clearing must still continue.
    }
    try {
      sessionStorage.removeItem('qurio.verificationEmail');
      await this.supabase.auth.signOut({ scope: 'local' });
    } finally {
      this.session.set(null);
      this.profile.set(null);
    }
  }

  resendVerification(email: string, captchaToken: string) {
    const token = this.requireCaptchaToken(captchaToken);
    return this.supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${environment.appUrl}/auth/callback`,
        captchaToken: token,
      },
    });
  }

  resetPassword(email: string, captchaToken: string) {
    const token = this.requireCaptchaToken(captchaToken);
    return this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${environment.appUrl}/auth/update-password?recovery=1`,
      captchaToken: token,
    });
  }

  private requireCaptchaToken(value: string): string {
    const token = value.trim();
    if (!this.captcha.authAllowed() || !this.captcha.canSubmit(token)) throw new Error('CAPTCHA_REQUIRED');
    return token;
  }

  updatePassword(password: string) {
    return this.supabase.auth.updateUser({ password });
  }

  async handleCallback(params: {
    code?: string | null;
    tokenHash?: string | null;
    type?: string | null;
  }): Promise<UserProfile | null> {
    let { data } = await this.supabase.auth.getSession();
    if (params.tokenHash && isEmailOtpType(params.type)) {
      const verified = await this.supabase.auth.verifyOtp({ token_hash: params.tokenHash, type: params.type });
      if (verified.error) throw verified.error;
      data = verified.data;
    } else if (params.code && (!data.session || currentUrlContainsCode(params.code))) {
      const exchanged = await this.supabase.auth.exchangeCodeForSession(params.code);
      if (exchanged.error) throw exchanged.error;
      data = exchanged.data;
    }
    if (!data.session) throw new Error('No verified authentication session was returned.');
    this.session.set(data.session);
    return this.refreshProfile();
  }

  async refreshProfile(): Promise<UserProfile | null> {
    const userId = this.user()?.id;
    if (!userId) {
      this.profile.set(null);
      return null;
    }
    if (this.profileRequest) return this.profileRequest;
    this.profileRequest = this.loadProfile(userId).finally(() => (this.profileRequest = undefined));
    return this.profileRequest;
  }

  routeForProfile(profile = this.profile()): string {
    if (!this.session()) return '/auth/login';
    if (!profile) return '/auth/pending';
    if (profile.status === 'approved') return '/home';
    if (profile.status === 'unverified') return '/auth/verify-email';
    return `/auth/${profile.status}`;
  }

  private async synchronizeProfile(session: Session | null): Promise<void> {
    if (!session) {
      this.profile.set(null);
      return;
    }
    await this.refreshProfile();
  }

  private async loadProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      console.warn('Unable to load the Qurio account profile.');
      return null;
    }
    const profile = data as UserProfile | null;
    this.profile.set(profile);
    return profile;
  }
}

function isEmailOtpType(value: string | null | undefined): value is EmailOtpType {
  return ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'].includes(value ?? '');
}

function currentUrlContainsCode(code: string): boolean {
  return typeof window !== 'undefined' && new URL(window.location.href).searchParams.get('code') === code;
}
