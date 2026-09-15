import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { CaptchaService } from './captcha.service';

describe('CaptchaService development configuration', () => {
  it('allows the application service to initialize but fails protected submissions closed', () => {
    const service = TestBed.inject(CaptchaService);
    expect(environment.production).toBe(false);
    expect(environment.turnstile.enabled).toBe(false);
    expect(service.enabled).toBe(false);
    expect(service.canSubmit('')).toBe(false);
    expect(service.canSubmit('unexpected-token')).toBe(false);
  });
});
