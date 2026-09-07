import { TestBed } from '@angular/core/testing';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import type { AccountStatus, UserProfile } from './auth.models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

describe('AuthService', () => {
  const signUp = vi.fn(async () => ({ data: { user: null, session: null }, error: null }));
  const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
  const exchangeCodeForSession = vi.fn(async () => ({
    data: { session: { user: { id: 'recovered-user' } } as Session },
    error: null,
  }));
  const getSession = vi.fn(async (): Promise<{ data: { session: Session | null }; error: null }> => ({
    data: { session: null },
    error: null,
  }));
  const client = {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession,
      signUp,
      resetPasswordForEmail,
      exchangeCodeForSession,
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [AuthService, { provide: SupabaseService, useValue: { client } }] });
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
    await auth.signUp('Qurio Learner', 'learner@example.test', 'a-password');
    expect(signUp).toHaveBeenCalledWith({
      email: 'learner@example.test',
      password: 'a-password',
      options: {
        data: { display_name: 'Qurio Learner' },
        emailRedirectTo: `${environment.appUrl}/auth/callback`,
      },
    });
  });

  it('marks password reset links as recovery routes', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.resetPassword('learner@example.test');
    expect(resetPasswordForEmail).toHaveBeenCalledWith('learner@example.test', {
      redirectTo: `${environment.appUrl}/auth/update-password?recovery=1`,
    });
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
