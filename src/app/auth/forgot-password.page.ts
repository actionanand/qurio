import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { safeAuthMessage } from './auth-page.shared';

@Component({
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonInput, IonSpinner],
  template: `<section class="auth-page">
    <article class="auth-card">
      <p class="eyebrow">Account recovery</p>
      <h1>Reset your password</h1>
      <p class="auth-intro">Enter your account email and we will send a secure reset link.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-input
          label="Email"
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
            Send reset link
          }
        </ion-button>
      </form>
      <a class="auth-link" routerLink="/auth/login">Back to sign in</a>
    </article>
  </section>`,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
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
    const result = await this.auth.resetPassword(this.form.getRawValue().email.trim());
    this.busy.set(false);
    if (result.error) {
      this.failed.set(true);
      this.message.set(safeAuthMessage(result.error, 'Unable to send a reset email. Please try again later.'));
    } else this.message.set('If an account exists for that email, a reset link has been sent.');
  }
}
