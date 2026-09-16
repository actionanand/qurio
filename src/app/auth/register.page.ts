import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { I18nService } from '../core/i18n.service';
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
        <p class="eyebrow">{{ i.t('startLearning') }}</p>
        <h1>{{ i.t('createQurioAccount') }}</h1>
        <p class="auth-intro">{{ i.t('registrationIntro') }}</p>
        <form [formGroup]="form" autocomplete="on" (ngSubmit)="submit()">
          <ion-input
            id="qurio-name"
            name="name"
            [label]="i.t('name')"
            labelPlacement="stacked"
            autocomplete="name"
            formControlName="name"
            fill="outline" />
          <ion-input
            id="qurio-register-email"
            name="email"
            [label]="i.t('email')"
            labelPlacement="stacked"
            type="email"
            autocomplete="email"
            formControlName="email"
            fill="outline" />
          <div class="auth-form-grid">
            <ion-input
              id="qurio-register-password"
              name="password"
              [label]="i.t('password')"
              labelPlacement="stacked"
              [type]="passwordVisible() ? 'text' : 'password'"
              autocomplete="new-password"
              formControlName="password"
              fill="outline">
              <ion-button
                slot="end"
                fill="clear"
                type="button"
                [attr.aria-label]="i.t(passwordVisible() ? 'hidePassword' : 'showPassword')"
                (click)="passwordVisible.update(value => !value)">
                <app-icon [name]="passwordVisible() ? 'eyeOff' : 'eye'" />
              </ion-button>
            </ion-input>
            <ion-input
              id="qurio-confirm-password"
              name="confirm-password"
              [label]="i.t('confirmPassword')"
              labelPlacement="stacked"
              [type]="confirmVisible() ? 'text' : 'password'"
              autocomplete="new-password"
              formControlName="confirmPassword"
              fill="outline">
              <ion-button
                slot="end"
                fill="clear"
                type="button"
                [attr.aria-label]="i.t(confirmVisible() ? 'hidePassword' : 'showPassword')"
                (click)="confirmVisible.update(value => !value)">
                <app-icon [name]="confirmVisible() ? 'eyeOff' : 'eye'" />
              </ion-button>
            </ion-input>
          </div>
          @if (passwordMismatch()) {
            <p class="form-message error" role="alert">{{ i.t('passwordsMismatch') }}</p>
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
              {{ i.t('createAccount') }}
            }
          </ion-button>
        </form>
        <p class="auth-switch">
          {{ i.t('alreadyRegistered') }} <a routerLink="/auth/login">{{ i.t('signIn') }}</a>
        </p>
      </article>
    </section>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly i = inject(I18nService);
  readonly captcha = inject(CaptchaService);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly captchaToken = signal('');
  readonly captchaReset = signal(0);
  readonly passwordVisible = signal(false);
  readonly confirmVisible = signal(false);
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
        this.message.set(safeAuthMessage(result.error, this.i.t('unableToCreateAccount'), key => this.i.t(key)));
        return;
      }
      sessionStorage.setItem('qurio.verificationEmail', normalizedEmail);
      await this.router.navigate(['/auth/verify-email']);
    } catch {
      this.message.set(this.i.t('unableToCreateAccount'));
    } finally {
      this.busy.set(false);
      this.captchaToken.set('');
      this.captchaReset.update(value => value + 1);
    }
  }
}
