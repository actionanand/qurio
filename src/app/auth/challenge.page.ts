import { Component, DestroyRef, inject, signal } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { AuthCaptchaComponent } from './auth-captcha.component';
import { CaptchaService } from './captcha.service';
import {
  createCaptchaMessage,
  createCaptchaReadyMessage,
  isCaptchaInitMessage,
  isOfficialHostedLocation,
} from './hosted-auth.util';

@Component({
  imports: [AuthCaptchaComponent],
  host: { class: 'challenge-page-host' },
  template: `
    <main class="challenge-page" aria-labelledby="challenge-title">
      <h1 id="challenge-title" class="visually-hidden">{{ i.t('captchaVerify') }}</h1>
      @if (!officialLocation()) {
        <p role="alert">{{ i.t('captchaUnavailable') }}</p>
      } @else if (!initialized()) {
        <p role="status">{{ i.t('challengeInvalid') }}</p>
      } @else {
        <app-auth-captcha [hostedMode]="true" (tokenChange)="complete($event)" />
        @if (completed()) {
          <p role="status">{{ i.t('verificationComplete') }}</p>
        }
      }
    </main>
  `,
})
export class ChallengePage {
  private readonly captcha = inject(CaptchaService);
  private readonly destroyRef = inject(DestroyRef);
  private requestId = '';
  private readonly expectedRequestId = new URLSearchParams(window.location.search).get('request') ?? '';
  private targetOrigin = '';
  private listening = true;
  readonly i = inject(I18nService);
  readonly completed = signal(false);
  readonly initialized = signal(false);
  readonly officialLocation = signal(isOfficialHostedLocation(window.location));

  constructor() {
    window.addEventListener('message', this.acceptInitialization);
    this.destroyRef.onDestroy(() => this.stopListening());
    queueMicrotask(() => this.announceReady());
  }

  complete(token: string): void {
    if (!this.initialized() || !token.trim() || !this.requestId || window.parent === window) return;
    window.parent.postMessage(createCaptchaMessage(this.requestId, token), this.targetOrigin);
    this.completed.set(true);
  }

  private readonly acceptInitialization = (event: MessageEvent<unknown>): void => {
    if (!this.officialLocation() || window.parent === window) return;
    if (event.source !== window.parent || event.origin !== this.captcha.nativeWebViewOrigin) return;
    if (!isCaptchaInitMessage(event.data)) return;
    if (event.data.requestId !== this.expectedRequestId) return;
    this.requestId = event.data.requestId;
    this.targetOrigin = event.origin;
    this.initialized.set(true);
    this.stopListening();
  };

  private announceReady(): void {
    if (!this.officialLocation() || window.parent === window || !/^[a-f0-9-]{20,}$/i.test(this.expectedRequestId))
      return;
    window.parent.postMessage(createCaptchaReadyMessage(this.expectedRequestId), this.captcha.nativeWebViewOrigin);
  }

  private stopListening(): void {
    if (!this.listening) return;
    window.removeEventListener('message', this.acceptInitialization);
    this.listening = false;
  }
}
