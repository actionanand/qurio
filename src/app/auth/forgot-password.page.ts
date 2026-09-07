import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { I18nService } from '../core/i18n.service';
import { AuthService } from '../services/auth.service';
import { safeAuthMessage } from './auth-page.shared';

@Component({
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonInput, IonSpinner],
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
        <ion-button type="submit" expand="block" [disabled]="form.invalid || busy()">
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
  readonly busy = signal(false);
  readonly failed = signal(false);
  readonly message = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });
  async submit() {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    this.message.set('');
    try {
      const result = await this.auth.resetPassword(this.form.getRawValue().email.trim());
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
    }
  }
}
