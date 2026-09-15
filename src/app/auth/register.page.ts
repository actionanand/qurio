import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { IconComponent } from '../shared/icon.component';
import { AuthCaptchaComponent } from './auth-captcha.component';
import { safeAuthMessage } from './auth-page.shared';
import { CaptchaService } from './captcha.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonInput, IonSpinner, IconComponent, AuthCaptchaComponent],
  template: `
    <section class="auth-page">
      <article class="auth-card auth-card-wide">
        <div class="auth-mark"><app-icon name="book" /></div>
        <p class="eyebrow">Start learning</p>
        <h1>Create your Qurio account</h1>
        <p class="auth-intro">After confirming your email, your account will be reviewed for approval.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <ion-input label="Name" labelPlacement="stacked" autocomplete="name" formControlName="name" fill="outline" />
          <ion-input
            label="Email"
            labelPlacement="stacked"
            type="email"
            autocomplete="email"
            formControlName="email"
            fill="outline" />
          <div class="auth-form-grid">
            <ion-input
              label="Password"
              labelPlacement="stacked"
              type="password"
              autocomplete="new-password"
              formControlName="password"
              fill="outline" />
            <ion-input
              label="Confirm password"
              labelPlacement="stacked"
              type="password"
              autocomplete="new-password"
              formControlName="confirmPassword"
              fill="outline" />
          </div>
          @if (passwordMismatch()) {
            <p class="form-message error" role="alert">Passwords do not match.</p>
          }
          @if (message()) {
            <p class="form-message error" role="alert">{{ message() }}</p>
          }
          <app-auth-captcha [resetNonce]="captchaReset()" (tokenChange)="captchaToken.set($event)" />
          <ion-button
            type="submit"
            expand="block"
            [disabled]="
              form.invalid ||
              passwordMismatch() ||
              busy() ||
              !captcha.authAllowed() ||
              !captcha.canSubmit(captchaToken())
            ">
            @if (busy()) {
              <ion-spinner name="crescent" />
            } @else {
              Create account
            }
          </ion-button>
        </form>
        <p class="auth-switch">Already registered? <a routerLink="/auth/login">Sign in</a></p>
      </article>
    </section>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly captcha = inject(CaptchaService);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly captchaToken = signal('');
  readonly captchaReset = signal(0);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  passwordMismatch = () => {
    const { password, confirmPassword } = this.form.getRawValue();
    return !!confirmPassword && password !== confirmPassword;
  };

  async submit() {
    if (
      this.form.invalid ||
      this.passwordMismatch() ||
      this.busy() ||
      !this.captcha.authAllowed() ||
      !this.captcha.canSubmit(this.captchaToken())
    )
      return;
    this.busy.set(true);
    this.message.set('');
    const { name, email, password } = this.form.getRawValue();
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const result = await this.auth.signUp(name.trim(), normalizedEmail, password, this.captchaToken());
      if (result.error) {
        this.message.set(safeAuthMessage(result.error, 'Unable to create the account. Please try again later.'));
        return;
      }
      sessionStorage.setItem('qurio.verificationEmail', normalizedEmail);
      await this.router.navigate(['/auth/verify-email']);
    } catch {
      this.message.set('Unable to create the account. Please try again later.');
    } finally {
      this.busy.set(false);
      this.captchaToken.set('');
      this.captchaReset.update(value => value + 1);
    }
  }
}
