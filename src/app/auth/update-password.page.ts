import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { safeAuthMessage } from './auth-page.shared';

@Component({
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonInput, IonSpinner],
  template: `<section class="auth-page">
    <article class="auth-card">
      <p class="eyebrow">Account recovery</p>
      <h1>Choose a new password</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-input
          label="New password"
          labelPlacement="stacked"
          type="password"
          autocomplete="new-password"
          formControlName="password"
          fill="outline" /><ion-input
          label="Confirm password"
          labelPlacement="stacked"
          type="password"
          autocomplete="new-password"
          formControlName="confirm"
          fill="outline" />
        @if (mismatch()) {
          <p class="form-message error">Passwords do not match.</p>
        }
        @if (message()) {
          <p class="form-message error" role="alert">{{ message() }}</p>
        }
        <ion-button type="submit" expand="block" [disabled]="form.invalid || mismatch() || busy()">
          @if (busy()) {
            <ion-spinner name="crescent" />
          } @else {
            Update password
          }
        </ion-button>
      </form>
      <a class="auth-link" routerLink="/auth/login">Back to sign in</a>
    </article>
  </section>`,
})
export class UpdatePasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  constructor() {
    void this.auth
      .handleCallback({
        code: this.route.snapshot.queryParamMap.get('code'),
        tokenHash: this.route.snapshot.queryParamMap.get('token_hash'),
        type: this.route.snapshot.queryParamMap.get('type'),
      })
      .catch(() => this.message.set('This recovery link is invalid or expired. Request a new reset link.'));
  }
  mismatch = () => {
    const value = this.form.getRawValue();
    return !!value.confirm && value.password !== value.confirm;
  };
  async submit() {
    if (this.form.invalid || this.mismatch() || this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    await this.auth.waitUntilInitialized();
    if (!this.auth.authenticated()) {
      this.busy.set(false);
      this.message.set('This recovery link is invalid or expired. Request a new reset link.');
      return;
    }
    const result = await this.auth.updatePassword(this.form.getRawValue().password);
    this.busy.set(false);
    if (result.error) {
      this.message.set(safeAuthMessage(result.error, 'Unable to update the password.'));
      return;
    }
    await this.auth.signOut();
    await this.router.navigate(['/auth/login'], { replaceUrl: true });
  }
}
