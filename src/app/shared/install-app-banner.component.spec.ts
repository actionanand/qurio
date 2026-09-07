import { describe, expect, it } from 'vitest';
import { buildAndroidIntent } from './install-app-banner.component';

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
});
