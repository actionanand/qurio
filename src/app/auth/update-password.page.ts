import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { I18nService } from '../core/i18n.service';
import { AuthService } from '../services/auth.service';
import { safeAuthMessage } from './auth-page.shared';

@Component({
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonInput, IonSpinner],
  template: `<section class="auth-page">
    <article class="auth-card">
      <p class="eyebrow">{{ i.t('accountRecovery') }}</p>
      <h1>{{ i.t('chooseNewPassword') }}</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-input
          [label]="i.t('newPassword')"
          labelPlacement="stacked"
          type="password"
          autocomplete="new-password"
          formControlName="password"
          fill="outline" /><ion-input
          [label]="i.t('confirmPassword')"
          labelPlacement="stacked"
          type="password"
          autocomplete="new-password"
          formControlName="confirm"
          fill="outline" />
        @if (mismatch()) {
          <p class="form-message error">{{ i.t('passwordsMismatch') }}</p>
        }
        @if (message()) {
          <p class="form-message error" role="alert">{{ message() }}</p>
        }
        <ion-button type="submit" expand="block" [disabled]="!recoveryReady() || form.invalid || mismatch() || busy()">
          @if (busy()) {
            <ion-spinner name="crescent" />
          } @else {
            {{ i.t('updatePassword') }}
          }
        </ion-button>
      </form>
      <a class="auth-link" routerLink="/auth/login">{{ i.t('backToSignIn') }}</a>
    </article>
  </section>`,
})
export class UpdatePasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly i = inject(I18nService);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly recoveryReady = signal(false);
  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  constructor() {
    void this.prepareRecovery();
  }
  private async prepareRecovery() {
    const query = this.route.snapshot.queryParamMap;
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const recoveryRequested =
      query.get('recovery') === '1' || query.get('type') === 'recovery' || fragment.get('type') === 'recovery';
    if (!recoveryRequested) {
      this.message.set(this.i.t('invalidRecoveryLink'));
      return;
    }
    try {
      await this.auth.handleCallback({
        code: query.get('code'),
        tokenHash: query.get('token_hash'),
        type: query.get('type') ?? fragment.get('type'),
      });
      this.recoveryReady.set(true);
    } catch {
      this.message.set(this.i.t('invalidRecoveryLink'));
    }
  }
  mismatch = () => {
    const value = this.form.getRawValue();
    return !!value.confirm && value.password !== value.confirm;
  };
  async submit() {
    if (!this.recoveryReady() || this.form.invalid || this.mismatch() || this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    await this.auth.waitUntilInitialized();
    if (!this.auth.authenticated()) {
      this.busy.set(false);
      this.message.set(this.i.t('invalidRecoveryLink'));
      return;
    }
    const result = await this.auth.updatePassword(this.form.getRawValue().password);
    this.busy.set(false);
    if (result.error) {
      this.message.set(safeAuthMessage(result.error, this.i.t('unableToUpdatePassword')));
      return;
    }
    await this.auth.signOut();
    await this.router.navigate(['/auth/login'], { replaceUrl: true });
  }
}
