import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonSpinner } from '@ionic/angular';
import { I18nService } from '../core/i18n.service';
import { AuthService } from '../services/auth.service';
import type { AccountStatus } from '../services/auth.models';
import { IconComponent } from '../shared/icon.component';

@Component({
  imports: [IonButton, IonSpinner, IconComponent],
  template: `
    <section class="auth-page">
      <article class="auth-card auth-status-card">
        <div class="auth-mark">
          <app-icon [name]="status === 'pending' ? 'time' : status === 'denied' ? 'close' : 'warning'" />
        </div>
        <p class="eyebrow">{{ i.t('accountStatus') }}</p>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
        @if (auth.profile()?.status_reason) {
          <div class="approval-note">
            <span
              ><strong>{{ i.t('reason') }}:</strong> {{ auth.profile()?.status_reason }}</span
            >
          </div>
        }
        @if (status === 'pending') {
          <p class="verification-state">
            {{ i.t('email') }}:
            <strong>{{ auth.emailVerified() ? i.t('emailVerified') : i.t('notYetVerified') }}</strong>
          </p>
          <ion-button [disabled]="busy()" (click)="refresh()">
            @if (busy()) {
              <ion-spinner name="crescent" />
            } @else {
              {{ i.t('refreshStatus') }}
            }
          </ion-button>
        }
        <ion-button fill="clear" color="medium" [disabled]="busy()" (click)="signOut()">{{
          i.t('signOut')
        }}</ion-button>
      </article>
    </section>
  `,
})
export class AccountStatusPage {
  readonly auth = inject(AuthService);
  readonly i = inject(I18nService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly status = inject(ActivatedRoute).snapshot.data['status'] as AccountStatus;
  get title() {
    return this.i.t(
      this.status === 'pending'
        ? 'waitingForApproval'
        : this.status === 'denied'
          ? 'accountNotApproved'
          : 'accountSuspended',
    );
  }
  get description() {
    return this.i.t(
      this.status === 'pending'
        ? 'pendingAccountIntro'
        : this.status === 'denied'
          ? 'deniedAccountIntro'
          : 'suspendedAccountIntro',
    );
  }
  async refresh() {
    this.busy.set(true);
    const profile = await this.auth.refreshProfile();
    this.busy.set(false);
    await this.router.navigateByUrl(this.auth.routeForProfile(profile));
  }
  async signOut() {
    this.busy.set(true);
    await this.auth.signOut();
    await this.router.navigateByUrl('/auth/login');
  }
}
