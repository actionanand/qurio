import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonSpinner } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

@Component({
  imports: [IonSpinner],
  template: `
    <section class="auth-page">
      <article class="auth-card auth-status-card">
        @if (error()) {
          <p class="eyebrow">Unable to continue</p>
          <h1>Verification link problem</h1>
          <p role="alert">{{ error() }}</p>
        } @else {
          <ion-spinner name="crescent" />
          <h1>Confirming your account</h1>
          <p>Securely checking your email and approval status…</p>
        }
      </article>
    </section>
  `,
})
export class AuthCallbackPage {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly error = signal('');
  constructor() {
    void this.complete();
  }
  private async complete() {
    try {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const callbackError =
        this.route.snapshot.queryParamMap.get('error_description') ?? fragment.get('error_description');
      if (callbackError) throw new Error(callbackError);
      const profile = await this.auth.handleCallback({
        code: this.route.snapshot.queryParamMap.get('code'),
        tokenHash: this.route.snapshot.queryParamMap.get('token_hash'),
        type: this.route.snapshot.queryParamMap.get('type'),
      });
      await this.router.navigateByUrl(this.auth.routeForProfile(profile), { replaceUrl: true });
    } catch {
      this.error.set('This link is invalid or has expired. Please sign in or request another verification email.');
    }
  }
}
