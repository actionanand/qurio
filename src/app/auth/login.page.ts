import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { IconComponent } from '../shared/icon.component';
import { safeAuthMessage } from './auth-page.shared';

@Component({
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonInput, IonSpinner, IconComponent],
  template: `
    <section class="auth-page">
      <article class="auth-card">
        <div class="auth-mark"><app-icon name="book" /></div>
        <p class="eyebrow">Welcome back</p>
        <h1>Sign in to Qurio</h1>
        <p class="auth-intro">Continue learning with your approved Qurio account.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <ion-input
            label="Email"
            labelPlacement="stacked"
            type="email"
            autocomplete="email"
            formControlName="email"
            fill="outline" />
          <ion-input
            label="Password"
            labelPlacement="stacked"
            type="password"
            autocomplete="current-password"
            formControlName="password"
            fill="outline" />
          @if (message()) {
            <p class="form-message error" role="alert">{{ message() }}</p>
          }
          <ion-button type="submit" expand="block" [disabled]="form.invalid || busy()">
            @if (busy()) {
              <ion-spinner name="crescent" />
            } @else {
              Sign in
            }
          </ion-button>
        </form>
        <a class="auth-link" routerLink="/auth/forgot-password">Forgot password?</a>
        <p class="auth-switch">New to Qurio? <a routerLink="/auth/register">Create an account</a></p>
      </article>
    </section>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit() {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    const { email, password } = this.form.getRawValue();
    const result = await this.auth.signIn(email.trim(), password);
    this.busy.set(false);
    if (result.error) {
      if (result.error.code === 'email_not_confirmed') {
        sessionStorage.setItem('qurio.verificationEmail', email.trim().toLowerCase());
        await this.router.navigateByUrl('/auth/verify-email');
        return;
      }
      this.message.set(safeAuthMessage(result.error, 'Unable to sign in. Please try again.'));
      return;
    }
    await this.router.navigateByUrl(this.auth.routeForProfile());
  }
}
