import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { IconComponent } from '../shared/icon.component';
import { AuthCaptchaComponent } from './auth-captcha.component';
import { safeAuthMessage } from './auth-page.shared';
import { CaptchaService } from './captcha.service';

@Component({
  imports: [RouterLink, IonButton, IonSpinner, IconComponent, AuthCaptchaComponent],
  template: `
    <section class="auth-page">
      <article class="auth-card auth-status-card">
        <div class="auth-mark"><app-icon name="mail" /></div>
        <p class="eyebrow">Check your inbox</p>
        <h1>Verify your email</h1>
        <p>
          We sent a confirmation link
          @if (email) {
            to <strong>{{ email }}</strong>
          }
          . Open it to verify your email.
        </p>
        <div class="approval-note">
          <app-icon name="info" /><span
            >Email verification comes first. An administrator must then approve your Qurio account.</span
          >
        </div>
        @if (message()) {
          <p class="form-message" [class.error]="failed()" role="status">{{ message() }}</p>
        }
        <app-auth-captcha [resetNonce]="captchaReset()" (tokenChange)="captchaToken.set($event)" />
        <ion-button
          fill="outline"
          [disabled]="
            !email || cooldown() > 0 || busy() || !captcha.authAllowed() || !captcha.canSubmit(captchaToken())
          "
          (click)="resend()">
          @if (busy()) {
            <ion-spinner name="crescent" />
          } @else if (cooldown() > 0) {
            Resend in {{ cooldown() }}s
          } @else {
            Resend verification email
          }
        </ion-button>
        <a class="auth-link" routerLink="/auth/login">Back to sign in</a>
      </article>
    </section>
  `,
})
export class VerifyEmailPage {
  private readonly auth = inject(AuthService);
  readonly captcha = inject(CaptchaService);
  readonly email = sessionStorage.getItem('qurio.verificationEmail') ?? this.auth.user()?.email ?? '';
  readonly busy = signal(false);
  readonly cooldown = signal(0);
  readonly message = signal('');
  readonly failed = signal(false);
  readonly captchaToken = signal('');
  readonly captchaReset = signal(0);

  async resend() {
    if (
      !this.email ||
      this.busy() ||
      this.cooldown() ||
      !this.captcha.authAllowed() ||
      !this.captcha.canSubmit(this.captchaToken())
    )
      return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      const result = await this.auth.resendVerification(this.email, this.captchaToken());
      if (result.error) {
        this.failed.set(true);
        this.message.set(safeAuthMessage(result.error, 'Unable to resend the email. Please try again later.'));
        return;
      }
      this.message.set('A new verification email has been sent.');
      this.cooldown.set(60);
      const timer = window.setInterval(() => {
        this.cooldown.update(value => Math.max(0, value - 1));
        if (!this.cooldown()) window.clearInterval(timer);
      }, 1000);
    } catch {
      this.failed.set(true);
      this.message.set('Unable to resend the email. Please try again later.');
    } finally {
      this.busy.set(false);
      this.captchaToken.set('');
      this.captchaReset.update(value => value + 1);
    }
  }
}
