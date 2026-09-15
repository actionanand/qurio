import { describe, expect, it } from 'vitest';
import { buildAndroidIntent, shouldShowAndroidBanner } from './install-app-banner.component';

describe('buildAndroidIntent', () => {
  it('builds an Android intent with an encoded Play Store fallback', () => {
    const result = buildAndroidIntent(
      'qurio://home',
      'com.actionanand.qurio.app',
      'https://play.google.com/store/apps/details?id=com.actionanand.qurio.app',
    );
    expect(result).toContain('intent://home#Intent;scheme=qurio;package=com.actionanand.qurio.app;');
    expect(result).toContain('S.browser_fallback_url=https%3A%2F%2Fplay.google.com');
  });
  it('shows only in an Android browser when promotion is enabled and not dismissed', () => {
    expect(shouldShowAndroidBanner(true, false, 'Android Chrome/140', false)).toBe(true);
    expect(shouldShowAndroidBanner(true, true, 'Android Chrome/140', false)).toBe(false);
    expect(shouldShowAndroidBanner(true, false, 'Windows Chrome/140', false)).toBe(false);
    expect(shouldShowAndroidBanner(true, false, 'Android Chrome/140', true)).toBe(false);
  });
});
