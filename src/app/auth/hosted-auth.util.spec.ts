import { describe, expect, it } from 'vitest';
import { environment as productionEnvironment } from '../../environments/environment.prod';
import {
  createCaptchaMessage,
  createCaptchaInitMessage,
  hostedChallengeUrl,
  isAllowedNativeChallengeCaller,
  isCaptchaMessage,
  isCaptchaInitMessage,
  isOfficialHostedLocation,
  isTrustedCaptchaEvent,
  officialAppBasePath,
  officialAppOrigin,
  validateTurnstileConfiguration,
} from './hosted-auth.util';

describe('hosted authentication URL policy', () => {
  const appUrl = productionEnvironment.appUrl;

  it('derives the production origin, base path and challenge URL from environment.appUrl', () => {
    expect(officialAppOrigin(appUrl)).toBe(new URL(appUrl).origin);
    expect(officialAppBasePath(appUrl)).toBe('/qurio');
    expect(hostedChallengeUrl(appUrl)).toBe(`${appUrl}/auth/challenge`);
  });

  it('accepts only the configured origin and deployed base path', () => {
    const official = new URL(appUrl);
    expect(
      isOfficialHostedLocation({ origin: official.origin, pathname: `${official.pathname}/auth/login` }, appUrl),
    ).toBe(true);
    expect(isOfficialHostedLocation({ origin: 'https://example.test', pathname: '/qurio/auth/login' }, appUrl)).toBe(
      false,
    );
    expect(isOfficialHostedLocation({ origin: official.origin, pathname: '/another-app/auth/login' }, appUrl)).toBe(
      false,
    );
  });

  it('refuses a disabled or unconfigured production challenge', () => {
    expect(() =>
      validateTurnstileConfiguration({ production: true, turnstile: { enabled: false, siteKey: 'site-key' } }),
    ).toThrow();
    expect(() => validateTurnstileConfiguration(productionEnvironment)).not.toThrow();
    expect(() =>
      validateTurnstileConfiguration({ production: true, turnstile: { enabled: true, siteKey: '' } }),
    ).toThrow();
    expect(() =>
      validateTurnstileConfiguration({ production: true, turnstile: { enabled: true, siteKey: 'configured-key' } }),
    ).not.toThrow();
  });

  it('keeps the Capacitor transport origin separate from the hosted Turnstile URL', () => {
    expect(hostedChallengeUrl(appUrl)).not.toContain('localhost');
    expect(
      isAllowedNativeChallengeCaller(
        productionEnvironment.androidApp.webViewOrigin,
        productionEnvironment.androidApp.webViewOrigin,
      ),
    ).toBe(true);
    expect(isAllowedNativeChallengeCaller('http://localhost', productionEnvironment.androidApp.webViewOrigin)).toBe(
      false,
    );
  });

  it('validates correlation, message type and a non-empty token', () => {
    const valid = { type: 'qurio:captcha-result', requestId: 'request-1', captchaToken: 'captcha-token' };
    expect(isCaptchaMessage(valid, 'request-1')).toBe(true);
    expect(isCaptchaMessage(valid, 'request-2')).toBe(false);
    expect(isCaptchaMessage({ ...valid, type: 'other' }, 'request-1')).toBe(false);
    expect(isCaptchaMessage({ ...valid, captchaToken: ' ' }, 'request-1')).toBe(false);
    expect(isCaptchaInitMessage(createCaptchaInitMessage('08ccf240-5f00-42fd-a55c-d95f800fad2c'))).toBe(true);
    expect(isCaptchaInitMessage(createCaptchaInitMessage('short'))).toBe(false);
  });

  it('accepts a challenge message only from the official origin and expected iframe', () => {
    const source = window;
    const data = createCaptchaMessage('request-1', 'captcha-token');
    expect(
      isTrustedCaptchaEvent(
        { origin: new URL(appUrl).origin, source, data },
        new URL(appUrl).origin,
        source,
        'request-1',
      ),
    ).toBe(true);
    expect(
      isTrustedCaptchaEvent(
        { origin: 'https://attacker.test', source, data },
        new URL(appUrl).origin,
        source,
        'request-1',
      ),
    ).toBe(false);
    expect(
      isTrustedCaptchaEvent(
        { origin: new URL(appUrl).origin, source: null, data },
        new URL(appUrl).origin,
        source,
        'request-1',
      ),
    ).toBe(false);
  });

  it('transports only correlation metadata and the CAPTCHA token', () => {
    const message = createCaptchaMessage('request-1', 'captcha-token');
    expect(Object.keys(message).sort()).toEqual(['captchaToken', 'requestId', 'type']);
    expect(message).not.toHaveProperty('email');
    expect(message).not.toHaveProperty('password');
    expect(message).not.toHaveProperty('access_token');
    expect(message).not.toHaveProperty('refresh_token');
  });
});
