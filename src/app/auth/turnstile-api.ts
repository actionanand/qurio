export interface TurnstileRenderOptions {
  sitekey: string;
  theme: 'auto';
  size: 'flexible';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loader: Promise<TurnstileApi> | undefined;
export const turnstileScriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader) return loader;
  const request = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-qurio-turnstile]');
    const script = existing ?? document.createElement('script');
    const complete = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable')));
    script.addEventListener('load', complete, { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile unavailable')), { once: true });
    if (!existing) {
      script.src = turnstileScriptUrl;
      script.async = true;
      script.defer = true;
      script.dataset['qurioTurnstile'] = '';
      document.head.append(script);
    }
  });
  loader = request.catch(error => {
    loader = undefined;
    throw error;
  });
  return loader;
}
