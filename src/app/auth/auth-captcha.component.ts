import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { I18nService } from '../core/i18n.service';
import { CaptchaService } from './captcha.service';
import { hostedChallengeRequestUrl, isTrustedCaptchaEvent } from './hosted-auth.util';
import { loadTurnstile } from './turnstile-api';

export type CaptchaState = 'disabled' | 'loading' | 'ready' | 'verified' | 'expired' | 'error';

@Component({
  selector: 'app-auth-captcha',
  template: `
    <div class="auth-captcha" [attr.aria-busy]="state() === 'loading'">
      @if (!captcha.enabled) {
        <p role="alert">{{ i.t('captchaDisabled') }}</p>
      } @else if (!captcha.authAllowed() && !hostedMode()) {
        <p role="alert">
          {{ i.t('officialAppOnly') }}
          <a [href]="captcha.officialAppUrl">{{ i.t('openQurio') }}</a>
        </p>
      } @else {
        @if (useHostedFrame()) {
          <iframe
            #frame
            class="auth-captcha-frame"
            [title]="i.t('humanVerification')"
            [src]="frameUrl()"
            (load)="hostedFrameLoaded()"
            sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
        } @else {
          <div #container class="auth-captcha-widget" [attr.aria-label]="i.t('humanVerification')"></div>
        }
        @switch (state()) {
          @case ('loading') {
            <p role="status">{{ i.t('captchaLoading') }}</p>
          }
          @case ('ready') {
            <p role="status">{{ i.t('captchaVerify') }}</p>
          }
          @case ('expired') {
            <p role="alert">{{ i.t('captchaExpired') }}</p>
            <button class="auth-captcha-retry" type="button" (click)="reset()">{{ i.t('retry') }}</button>
          }
          @case ('error') {
            <p role="alert">{{ i.t('captchaFailed') }}</p>
            <button class="auth-captcha-retry" type="button" (click)="reset()">{{ i.t('retry') }}</button>
          }
        }
      }
    </div>
  `,
})
export class AuthCaptchaComponent {
  readonly resetNonce = input(0);
  readonly hostedMode = input(false);
  readonly tokenChange = output<string>();
  readonly stateChange = output<CaptchaState>();
  readonly captcha = inject(CaptchaService);
  readonly i = inject(I18nService);
  readonly state = signal<CaptchaState>(this.captcha.enabled ? 'loading' : 'disabled');
  readonly token = signal('');
  readonly frameUrl = signal<SafeResourceUrl | null>(null);
  readonly useHostedFrame = computed(() => this.captcha.native && !this.hostedMode());
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild<ElementRef<HTMLElement>>('container');
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private widgetId?: string;
  private requestId = '';
  private rendered = false;
  private destroyed = false;
  private lastReset = 0;
  private nativeMessageListener?: (event: MessageEvent<unknown>) => void;
  private nativeTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearToken(false);
      this.cleanupNativeChallenge();
      if (this.widgetId && window.turnstile) window.turnstile.remove(this.widgetId);
      this.widgetId = undefined;
    });
    effect(() => {
      const nonce = this.resetNonce();
      if (!this.rendered || nonce === this.lastReset) return;
      this.lastReset = nonce;
      this.reset();
    });
    afterNextRender(() => {
      this.rendered = true;
      this.lastReset = this.resetNonce();
      this.start();
    });
  }

  reset(): void {
    this.clearToken();
    if (!this.captcha.enabled) return this.setState('disabled');
    if (this.useHostedFrame()) this.startHostedFrame();
    else if (this.widgetId && window.turnstile) {
      window.turnstile.reset(this.widgetId);
      this.setState('ready');
    } else void this.startWidget();
  }

  hostedFrameLoaded(): void {
    if (this.useHostedFrame() && this.requestId) this.setState('ready');
  }

  private start(): void {
    this.clearToken();
    if (!this.captcha.enabled) return this.setState('disabled');
    if (!this.captcha.authAllowed() && !this.hostedMode()) return this.setState('error');
    if (this.useHostedFrame()) this.startHostedFrame();
    else void this.startWidget();
  }

  private async startWidget(): Promise<void> {
    this.setState('loading');
    try {
      const api = await loadTurnstile();
      if (this.destroyed) return;
      const container = this.container()?.nativeElement;
      if (!container) throw new Error('Turnstile container unavailable');
      if (this.widgetId) api.remove(this.widgetId);
      this.widgetId = api.render(container, {
        sitekey: this.captcha.siteKey,
        theme: 'auto',
        size: 'flexible',
        callback: token => {
          this.publishToken(token);
          this.setState('verified');
        },
        'expired-callback': () => {
          this.clearToken();
          this.setState('expired');
        },
        'error-callback': () => {
          this.clearToken();
          this.setState('error');
        },
      });
      this.setState('ready');
    } catch {
      if (!this.destroyed) this.setState('error');
    }
  }

  private startHostedFrame(): void {
    this.cleanupNativeChallenge();
    this.clearToken();
    this.setState('loading');
    this.requestId = crypto.randomUUID();
    this.nativeMessageListener = event => this.receiveMessage(event);
    window.addEventListener('message', this.nativeMessageListener);
    this.nativeTimeout = setTimeout(() => {
      this.cleanupNativeChallenge();
      this.clearToken();
      this.setState('error');
    }, 120_000);
    this.frameUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(
        hostedChallengeRequestUrl(this.captcha.challengeUrl, this.requestId),
      ),
    );
  }

  private receiveMessage(event: MessageEvent<unknown>): void {
    const source = this.frame()?.nativeElement.contentWindow ?? null;
    if (!isTrustedCaptchaEvent(event, this.captcha.officialOrigin, source, this.requestId)) return;
    const message = event.data as { captchaToken: string };
    this.cleanupNativeChallenge();
    this.publishToken(message.captchaToken);
    this.setState('verified');
  }

  private publishToken(token: string): void {
    const normalized = token.trim();
    this.token.set(normalized);
    this.tokenChange.emit(normalized);
  }

  private clearToken(emit = true): void {
    this.token.set('');
    if (emit) this.tokenChange.emit('');
  }

  private cleanupNativeChallenge(): void {
    if (this.nativeMessageListener) window.removeEventListener('message', this.nativeMessageListener);
    if (this.nativeTimeout) clearTimeout(this.nativeTimeout);
    this.nativeMessageListener = undefined;
    this.nativeTimeout = undefined;
  }

  private setState(state: CaptchaState): void {
    this.state.set(state);
    this.stateChange.emit(state);
  }
}
