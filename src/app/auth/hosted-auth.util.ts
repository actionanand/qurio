import { environment } from '../../environments/environment';

export interface BrowserLocation {
  origin: string;
  pathname: string;
}

export interface TurnstileEnvironment {
  production: boolean;
  turnstile: { enabled: boolean; siteKey: string };
}

export function officialAppUrl(appUrl = environment.appUrl): URL {
  return new URL(appUrl);
}

export function officialAppOrigin(appUrl = environment.appUrl): string {
  return officialAppUrl(appUrl).origin;
}

export function officialAppBasePath(appUrl = environment.appUrl): string {
  const pathname = officialAppUrl(appUrl).pathname.replace(/\/$/, '');
  return pathname || '/';
}

export function hostedAuthUrl(path: `/${string}`, appUrl = environment.appUrl): string {
  return `${appUrl.replace(/\/$/, '')}${path}`;
}

export function hostedChallengeUrl(appUrl = environment.appUrl): string {
  return hostedAuthUrl('/auth/challenge', appUrl);
}

export function isOfficialHostedLocation(location: BrowserLocation, appUrl = environment.appUrl): boolean {
  if (location.origin !== officialAppOrigin(appUrl)) return false;
  const basePath = officialAppBasePath(appUrl);
  return basePath === '/' || location.pathname === basePath || location.pathname.startsWith(`${basePath}/`);
}

export function validateTurnstileConfiguration(config: TurnstileEnvironment): void {
  if (config.production && !config.turnstile.enabled) {
    throw new Error('Turnstile must be enabled in production.');
  }
  if (config.production && !config.turnstile.siteKey.trim()) {
    throw new Error('Configure the public Turnstile site key before deploying Qurio.');
  }
}

export function isAllowedNativeChallengeCaller(origin: string, expectedOrigin: string): boolean {
  return origin === expectedOrigin;
}

export function isCaptchaMessage(
  value: unknown,
  requestId: string,
): value is { type: 'qurio:captcha-result'; requestId: string; captchaToken: string } {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (
    message['type'] === 'qurio:captcha-result' &&
    message['requestId'] === requestId &&
    typeof message['captchaToken'] === 'string' &&
    message['captchaToken'].trim().length > 0
  );
}

export function isValidCaptchaRequestId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function captchaRequestIdFromLocation(location: Pick<Location, 'search' | 'hash'>): string {
  const query = new URLSearchParams(location.search).get('request') ?? '';
  const fragment = new URLSearchParams(location.hash.replace(/^#/, '')).get('request') ?? '';
  const requestId = query || fragment;
  return isValidCaptchaRequestId(requestId) ? requestId : '';
}

export function hostedChallengeRequestUrl(challengeUrl: string, requestId: string): string {
  if (!isValidCaptchaRequestId(requestId)) throw new Error('Invalid CAPTCHA request ID.');
  const url = new URL(challengeUrl);
  url.searchParams.set('request', requestId);
  url.hash = new URLSearchParams({ request: requestId }).toString();
  return url.toString();
}

export function isTrustedCaptchaEvent(
  event: Pick<MessageEvent<unknown>, 'origin' | 'source' | 'data'>,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null,
  requestId: string,
): boolean {
  return event.origin === expectedOrigin && event.source === expectedSource && isCaptchaMessage(event.data, requestId);
}

export function createCaptchaMessage(requestId: string, token: string) {
  return { type: 'qurio:captcha-result' as const, requestId, captchaToken: token.trim() };
}
