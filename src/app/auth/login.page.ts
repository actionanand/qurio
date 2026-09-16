import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { CredentialManagerService } from '../core/credential-manager.service';
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
      <article class="auth-card">
        <div class="auth-mark"><app-icon name="book" /></div>
        <p class="eyebrow">{{ i.t('welcomeBack') }}</p>
        <h1>{{ i.t('signInToQurio') }}</h1>
        <p class="auth-intro">{{ i.t('signInIntro') }}</p>
        <form [formGroup]="form" autocomplete="on" (ngSubmit)="submit()">
          <ion-input
            id="qurio-email"
            name="email"
            [label]="i.t('email')"
            labelPlacement="stacked"
            type="email"
            autocomplete="email"
            formControlName="email"
            fill="outline" />
          <ion-input
            id="qurio-password"
            name="password"
            [label]="i.t('password')"
            labelPlacement="stacked"
            [type]="passwordVisible() ? 'text' : 'password'"
            autocomplete="current-password"
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
          <app-auth-captcha [resetNonce]="captchaReset()" (tokenChange)="captchaToken.set($event)" />
          @if (message()) {
            <p class="form-message error" role="alert">{{ message() }}</p>
          }
          <ion-button
            type="submit"
            expand="block"
            [disabled]="form.invalid || busy() || !captcha.authAllowed() || !captcha.canSubmit(captchaToken())">
            @if (busy()) {
              <ion-spinner name="crescent" />
            } @else {
              {{ i.t('signIn') }}
            }
          </ion-button>
          @if (credentials.native) {
            <ion-button
              type="button"
              expand="block"
              fill="clear"
              [disabled]="busy() || credentialBusy()"
              (click)="useSavedCredentials()">
              @if (credentialBusy()) {
                <ion-spinner name="crescent" />
              } @else {
                <app-icon name="key" /> {{ i.t('useSavedCredentials') }}
              }
            </ion-button>
          }
          @if (credentialMessage()) {
            <p class="form-message" role="status">{{ credentialMessage() }}</p>
          }
        </form>
        <a class="auth-link" routerLink="/auth/forgot-password">{{ i.t('forgotPassword') }}</a>
        <p class="auth-switch">
          {{ i.t('newToQurio') }} <a routerLink="/auth/register">{{ i.t('createAccount') }}</a>
        </p>
      </article>
    </section>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly i = inject(I18nService);
  readonly credentials = inject(CredentialManagerService);
  readonly captcha = inject(CaptchaService);
  readonly busy = signal(false);
  readonly credentialBusy = signal(false);
  readonly message = signal('');
  readonly credentialMessage = signal('');
  readonly passwordVisible = signal(false);
  readonly captchaToken = signal('');
  readonly captchaReset = signal(0);
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit() {
    if (this.form.invalid || this.busy() || !this.captcha.authAllowed() || !this.captcha.canSubmit(this.captchaToken()))
      return;
    this.busy.set(true);
    this.message.set('');
    this.credentialMessage.set('');
    const { email, password } = this.form.getRawValue();
    try {
      const result = await this.auth.signIn(email.trim(), password, this.captchaToken());
      if (result.error) {
        if (result.error.code === 'email_not_confirmed') {
          sessionStorage.setItem('qurio.verificationEmail', email.trim().toLowerCase());
          await this.router.navigateByUrl('/auth/verify-email');
          return;
        }
        this.message.set(safeAuthMessage(result.error, this.i.t('unableToSignIn'), key => this.i.t(key)));
        return;
      }
      await this.credentials.savePassword(email.trim().toLowerCase(), password);
      await this.router.navigateByUrl(this.auth.routeForProfile());
    } catch {
      this.message.set(this.i.t('unableToSignIn'));
    } finally {
      this.busy.set(false);
      this.captchaToken.set('');
      this.captchaReset.update(value => value + 1);
    }
  }

  async useSavedCredentials(): Promise<void> {
    if (!this.credentials.native || this.busy() || this.credentialBusy()) return;
    this.credentialBusy.set(true);
    this.message.set('');
    this.credentialMessage.set('');
    try {
      const result = await this.credentials.getPassword();
      if (result.status === 'success') {
        this.form.patchValue({ email: result.email, password: result.password });
        this.passwordVisible.set(false);
        this.credentialMessage.set(this.i.t('savedCredentialsFilled'));
      } else if (result.status === 'not-found') {
        this.credentialMessage.set(this.i.t('noSavedCredentials'));
      } else if (result.status === 'unavailable') {
        this.credentialMessage.set(this.i.t('savedCredentialsUnavailable'));
      } else if (result.status === 'error') {
        this.credentialMessage.set(this.i.t('unableToRetrieveCredentials'));
      }
    } finally {
      this.credentialBusy.set(false);
    }
  }
}
