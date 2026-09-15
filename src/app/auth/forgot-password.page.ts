import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { I18nService } from '../core/i18n.service';
import { AuthService } from '../services/auth.service';
import { AuthCaptchaComponent } from './auth-captcha.component';
import { safeAuthMessage } from './auth-page.shared';
import { CaptchaService } from './captcha.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonInput, IonSpinner, AuthCaptchaComponent],
  template: `<section class="auth-page">
    <article class="auth-card">
      <p class="eyebrow">{{ i.t('accountRecovery') }}</p>
      <h1>{{ i.t('resetYourPassword') }}</h1>
      <p class="auth-intro">{{ i.t('resetPasswordIntro') }}</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-input
          [label]="i.t('email')"
          labelPlacement="stacked"
          type="email"
          autocomplete="email"
          formControlName="email"
          fill="outline" />
        @if (message()) {
          <p class="form-message" [class.error]="failed()" role="status">{{ message() }}</p>
        }
        <app-auth-captcha [resetNonce]="captchaReset()" (tokenChange)="captchaToken.set($event)" />
        <ion-button
          type="submit"
          expand="block"
          [disabled]="form.invalid || busy() || !captcha.authAllowed() || !captcha.canSubmit(captchaToken())">
          @if (busy()) {
            <ion-spinner name="crescent" />
          } @else {
            {{ i.t('sendResetLink') }}
          }
        </ion-button>
      </form>
      <a class="auth-link" routerLink="/auth/login">{{ i.t('backToSignIn') }}</a>
    </article>
  </section>`,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  readonly i = inject(I18nService);
  readonly captcha = inject(CaptchaService);
  readonly busy = signal(false);
  readonly failed = signal(false);
  readonly message = signal('');
  readonly captchaToken = signal('');
  readonly captchaReset = signal(0);
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });
  async submit() {
    if (this.form.invalid || this.busy() || !this.captcha.authAllowed() || !this.captcha.canSubmit(this.captchaToken()))
      return;
    this.busy.set(true);
    this.failed.set(false);
    this.message.set('');
    try {
      const result = await this.auth.resetPassword(this.form.getRawValue().email.trim(), this.captchaToken());
      if (result.error) {
        this.failed.set(true);
        this.message.set(safeAuthMessage(result.error, this.i.t('unableToSendReset')));
        return;
      }
      this.message.set(this.i.t('resetEmailSent'));
    } catch {
      this.failed.set(true);
      this.message.set(this.i.t('unableToSendReset'));
    } finally {
      this.busy.set(false);
      this.captchaToken.set('');
      this.captchaReset.update(value => value + 1);
    }
  }
}
