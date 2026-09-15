import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCaptchaComponent } from './auth-captcha.component';
import { CaptchaService } from './captcha.service';
import type { TurnstileRenderOptions } from './turnstile-api';
import { I18nService } from '../core/i18n.service';

describe('AuthCaptchaComponent', () => {
  let options: TurnstileRenderOptions | undefined;
  const reset = vi.fn();
  const remove = vi.fn();

  beforeEach(() => {
    options = undefined;
    reset.mockClear();
    remove.mockClear();
    window.turnstile = {
      render: vi.fn((_container, value) => {
        options = value;
        return 'widget-1';
      }),
      reset,
      remove,
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AuthCaptchaComponent],
      providers: [
        {
          provide: CaptchaService,
          useValue: {
            enabled: true,
            native: false,
            siteKey: 'public-site-key',
            challengeUrl: 'https://official.example/app/auth/challenge',
            officialOrigin: 'https://official.example',
            officialAppUrl: 'https://official.example/app',
            authAllowed: () => true,
          },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });
  });

  it('clears an expired token and requires a new challenge', async () => {
    const fixture = TestBed.createComponent(AuthCaptchaComponent);
    const tokens: string[] = [];
    fixture.componentInstance.tokenChange.subscribe(token => tokens.push(token));
    fixture.detectChanges();
    await fixture.whenStable();
    options?.callback('short-lived-token');
    expect(fixture.componentInstance.token()).toBe('short-lived-token');
    options?.['expired-callback']();
    expect(tokens).toContain('short-lived-token');
    expect(tokens.at(-1)).toBe('');
    expect(fixture.componentInstance.state()).toBe('expired');

    fixture.componentRef.setInput('resetNonce', 1);
    fixture.detectChanges();
    expect(reset).toHaveBeenCalledWith('widget-1');
    expect(fixture.componentInstance.state()).toBe('ready');
  });

  it('uses the configured site key and clears tokens on error, reset and destruction', async () => {
    const localStorageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const fixture = TestBed.createComponent(AuthCaptchaComponent);
    const tokens: string[] = [];
    fixture.componentInstance.tokenChange.subscribe(token => tokens.push(token));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(options?.sitekey).toBe('public-site-key');

    options?.callback('one-use-token');
    options?.['error-callback']();
    expect(fixture.componentInstance.token()).toBe('');
    expect(tokens.at(-1)).toBe('');

    options?.callback('second-token');
    fixture.componentInstance.reset();
    expect(fixture.componentInstance.token()).toBe('');
    expect(reset).toHaveBeenCalledWith('widget-1');
    expect(localStorageWrite).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining('token'));

    fixture.destroy();
    expect(remove).toHaveBeenCalledWith('widget-1');
    localStorageWrite.mockRestore();
  });
});
