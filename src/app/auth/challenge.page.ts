import { Component, inject, signal } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { AuthCaptchaComponent } from './auth-captcha.component';
import { CaptchaService } from './captcha.service';
import { captchaRequestIdFromLocation, createCaptchaMessage, isOfficialHostedLocation } from './hosted-auth.util';

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
  private readonly requestId = captchaRequestIdFromLocation(window.location);
  readonly i = inject(I18nService);
  readonly completed = signal(false);
  readonly officialLocation = signal(isOfficialHostedLocation(window.location));
  readonly initialized = signal(this.officialLocation() && window.parent !== window && !!this.requestId);

  complete(token: string): void {
    if (!this.initialized() || !token.trim() || !this.requestId || window.parent === window) return;
    window.parent.postMessage(createCaptchaMessage(this.requestId, token), this.captcha.nativeWebViewOrigin);
    this.completed.set(true);
  }
}
