import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTurnstile, turnstileScriptUrl, type TurnstileApi } from './turnstile-api';

describe('Turnstile API loader', () => {
  afterEach(() => {
    document.querySelector('script[data-qurio-turnstile]')?.remove();
    delete window.turnstile;
  });

  it('uses the official explicit-render script and shares one concurrent load', async () => {
    delete window.turnstile;
    const first = loadTurnstile();
    const second = loadTurnstile();
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-qurio-turnstile]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(turnstileScriptUrl);

    const api: TurnstileApi = { render: vi.fn(() => 'widget'), reset: vi.fn(), remove: vi.fn() };
    window.turnstile = api;
    scripts[0].dispatchEvent(new Event('load'));
    await expect(first).resolves.toBe(api);
    await expect(second).resolves.toBe(api);
  });
});
