import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login.page';
import { RegisterPage } from './register.page';
import { ForgotPasswordPage } from './forgot-password.page';
import { CaptchaService } from './captcha.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { I18nService } from '../core/i18n.service';

describe('authentication page CAPTCHA lifecycle', () => {
  const signIn = vi.fn(async () => ({ data: { session: null }, error: null }));
  const signUp = vi.fn(async () => ({ data: { session: null }, error: null }));
  const resetPassword = vi.fn(async () => ({ data: {}, error: null }));
  const auth = {
    signIn,
    signUp,
    resetPassword,
    routeForProfile: () => '/home',
  };
  const captcha = {
    enabled: true,
    officialAppUrl: 'https://official.example/app',
    authAllowed: () => true,
    canSubmit: (token: string) => token.length > 0,
  };
  const router = { navigateByUrl: vi.fn(async () => true), navigate: vi.fn(async () => true) };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: CaptchaService, useValue: captcha },
        { provide: Router, useValue: router },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });
  });

  it('does not submit web login without a CAPTCHA token', async () => {
    const page = TestBed.runInInjectionContext(() => new LoginPage());
    page.form.setValue({ email: 'learner@example.test', password: 'password' });
    await page.submit();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('fails closed when CAPTCHA is disabled in the current environment', async () => {
    const disabledCaptcha = { ...captcha, enabled: false, canSubmit: () => false };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: CaptchaService, useValue: disabledCaptcha },
        { provide: Router, useValue: router },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new LoginPage());
    page.form.setValue({ email: 'learner@example.test', password: 'password' });
    page.captchaToken.set('unexpected-token');
    await page.submit();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('uses and clears the login CAPTCHA token after an attempt', async () => {
    const page = TestBed.runInInjectionContext(() => new LoginPage());
    page.form.setValue({ email: 'learner@example.test', password: 'password' });
    page.captchaToken.set('login-token');
    await page.submit();
    expect(signIn).toHaveBeenCalledWith('learner@example.test', 'password', 'login-token');
    expect(page.captchaToken()).toBe('');
    expect(page.captchaReset()).toBe(1);
  });

  it('passes and clears CAPTCHA during signup', async () => {
    const page = TestBed.runInInjectionContext(() => new RegisterPage());
    page.form.setValue({
      name: 'Learner',
      email: 'learner@example.test',
      password: 'password',
      confirmPassword: 'password',
    });
    page.captchaToken.set('signup-token');
    await page.submit();
    expect(signUp).toHaveBeenCalledWith('Learner', 'learner@example.test', 'password', 'signup-token');
    expect(page.captchaToken()).toBe('');
  });

  it('passes and clears CAPTCHA during password reset', async () => {
    const page = TestBed.runInInjectionContext(() => new ForgotPasswordPage());
    page.form.setValue({ email: 'learner@example.test' });
    page.captchaToken.set('reset-token');
    await page.submit();
    expect(resetPassword).toHaveBeenCalledWith('learner@example.test', 'reset-token');
    expect(page.captchaToken()).toBe('');
  });

  it('rejects login from an unexpected production location through the UX guard', async () => {
    const blockedCaptcha = { ...captcha, authAllowed: () => false };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: CaptchaService, useValue: blockedCaptcha },
        { provide: Router, useValue: router },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new LoginPage());
    page.form.setValue({ email: 'learner@example.test', password: 'password' });
    page.captchaToken.set('token');
    await page.submit();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('never persists CAPTCHA tokens while submitting authentication', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const page = TestBed.runInInjectionContext(() => new LoginPage());
    page.form.setValue({ email: 'learner@example.test', password: 'password' });
    page.captchaToken.set('memory-only-token');
    await page.submit();
    expect(storage).not.toHaveBeenCalledWith(expect.any(String), 'memory-only-token');
    storage.mockRestore();
  });
});
