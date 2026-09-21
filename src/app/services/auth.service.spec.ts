import { TestBed } from '@angular/core/testing';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import type { AccountStatus, UserProfile } from './auth.models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { CaptchaService } from '../auth/captcha.service';
import { SecurityService } from '../core/security.service';

describe('AuthService', () => {
  const signUp = vi.fn(async () => ({ data: { user: null, session: null }, error: null }));
  const signInWithPassword = vi.fn(async () => ({ data: { user: null, session: null }, error: null }));
  const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
  const resend = vi.fn(async () => ({ data: { user: null, session: null }, error: null }));
  const exchangeCodeForSession = vi.fn(async () => ({
    data: { session: { user: { id: 'recovered-user' } } as Session },
    error: null,
  }));
  const getSession = vi.fn(async (): Promise<{ data: { session: Session | null }; error: null }> => ({
    data: { session: null },
    error: null,
  }));
  const signOut = vi.fn(async () => ({ error: null }));
  const invoke = vi.fn(async (): Promise<{ data: { ok: boolean } | null; error: Error | null }> => ({
    data: { ok: true },
    error: null,
  }));
  const clearUser = vi.fn(async () => undefined);
  const client = {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession,
      signUp,
      signInWithPassword,
      resetPasswordForEmail,
      resend,
      exchangeCodeForSession,
      signOut,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { ...profile('approved', '2026-09-07T00:00:00Z'), id: 'recovered-user' },
            error: null,
          })),
        })),
      })),
    })),
    functions: { invoke },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: { client } },
        { provide: CaptchaService, useValue: { authAllowed: () => true, canSubmit: (token: string) => !!token } },
        { provide: SecurityService, useValue: { clearUser } },
      ],
    });
  });

  it('keeps verification and approval as separate state', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.waitUntilInitialized();
    auth.session.set({ user: { id: 'user-1' } } as Session);
    auth.profile.set(profile('pending', '2026-09-07T00:00:00Z'));
    expect(auth.emailVerified()).toBe(true);
    expect(auth.approved()).toBe(false);
    expect(auth.routeForProfile()).toBe('/auth/pending');
  });

  it('uses the configured callback and display name during signup', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.signUp('Qurio Learner', 'learner@example.test', 'a-password', 'signup-captcha');
    expect(signUp).toHaveBeenCalledWith({
      email: 'learner@example.test',
      password: 'a-password',
      options: {
        data: { display_name: 'Qurio Learner' },
        emailRedirectTo: `${environment.appUrl}/auth/callback`,
        captchaToken: 'signup-captcha',
      },
    });
  });

  it('passes the CAPTCHA token during password sign-in', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.signIn('learner@example.test', 'a-password', 'login-captcha');
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'learner@example.test',
      password: 'a-password',
      options: { captchaToken: 'login-captcha' },
    });
  });

  it('marks password reset links as recovery routes', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.resetPassword('learner@example.test', 'reset-captcha');
    expect(resetPasswordForEmail).toHaveBeenCalledWith('learner@example.test', {
      redirectTo: `${environment.appUrl}/auth/update-password?recovery=1`,
      captchaToken: 'reset-captcha',
    });
  });

  it('passes CAPTCHA to the supported verification resend operation', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.resendVerification('learner@example.test', 'resend-captcha');
    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'learner@example.test',
      options: {
        emailRedirectTo: `${environment.appUrl}/auth/callback`,
        captchaToken: 'resend-captcha',
      },
    });
  });

  it('does not call protected Supabase Auth methods without a valid CAPTCHA token', async () => {
    const auth = TestBed.inject(AuthService);
    await expect(auth.signIn('learner@example.test', 'a-password', '')).rejects.toThrow('CAPTCHA_REQUIRED');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('exchanges a recovery code even when another session already exists', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.waitUntilInitialized();
    window.history.replaceState({}, '', '/auth/update-password?recovery=1&code=recovery-code');
    getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'previous-user' } } as Session },
      error: null,
    });
    await auth.handleCallback({ code: 'recovery-code' });
    expect(exchangeCodeForSession).toHaveBeenCalledWith('recovery-code');
    expect(auth.user()?.id).toBe('recovered-user');
    window.history.replaceState({}, '', '/');
  });

  it('deletes only the current account and clears its local security state', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.waitUntilInitialized();
    auth.session.set({ user: { id: 'user-1', email: 'learner@example.test' } } as Session);
    auth.profile.set(profile('approved', '2026-09-07T00:00:00Z'));

    await auth.deleteMyAccount('learner@example.test');

    expect(invoke).toHaveBeenCalledWith('delete-my-account', {
      body: { confirmationEmail: 'learner@example.test' },
    });
    expect(clearUser).toHaveBeenCalledWith('user-1');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.session()).toBeNull();
    expect(auth.profile()).toBeNull();
  });

  it('keeps the local session when remote account deletion fails', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('remote failure') });
    const auth = TestBed.inject(AuthService);
    await auth.waitUntilInitialized();
    auth.session.set({ user: { id: 'user-1', email: 'learner@example.test' } } as Session);
    auth.profile.set(profile('approved', '2026-09-07T00:00:00Z'));

    await expect(auth.deleteMyAccount('learner@example.test')).rejects.toThrow('remote failure');

    expect(clearUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(auth.user()?.id).toBe('user-1');
  });
});

function profile(status: AccountStatus, verifiedAt: string | null): UserProfile {
  return {
    id: 'user-1',
    email: 'learner@example.test',
    display_name: 'Learner',
    role: 'user',
    status,
    email_verified_at: verifiedAt,
    status_reason: null,
    status_changed_by: null,
    status_changed_at: null,
    role_changed_by: null,
    role_changed_at: null,
    created_at: '2026-09-07T00:00:00Z',
    updated_at: '2026-09-07T00:00:00Z',
  };
}
