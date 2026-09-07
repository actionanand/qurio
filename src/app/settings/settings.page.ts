import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { I18nService } from '../core/i18n.service';
import { AdminService } from '../services/admin.service';
import { AuthService } from '../services/auth.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  imports: [ReactiveFormsModule, IonButton, IonInput, IonSpinner, IconComponent],
  template: `
    <section class="settings-page">
      <div class="section-heading">
        <div>
          <p class="eyebrow">{{ i.t('settings') }}</p>
          <h1>{{ i.t('accountSettings') }}</h1>
          <p class="muted">{{ i.t('settingsIntro') }}</p>
        </div>
      </div>

      <div class="settings-grid">
        <section class="settings-card" aria-labelledby="profile-heading">
          <span class="settings-card-icon"><app-icon name="people" /></span>
          <div>
            <h2 id="profile-heading">{{ i.t('profile') }}</h2>
            <p class="muted">{{ auth.profile()?.email }}</p>
          </div>
          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
            <ion-input
              [label]="i.t('displayName')"
              labelPlacement="stacked"
              autocomplete="name"
              maxlength="120"
              formControlName="displayName"
              fill="outline" />
            @if (profileMessage()) {
              <p class="form-message" [class.error]="profileFailed()" role="status">{{ profileMessage() }}</p>
            }
            <ion-button type="submit" [disabled]="profileForm.invalid || profileBusy()">
              @if (profileBusy()) {
                <ion-spinner name="crescent" />
              } @else {
                {{ i.t('saveChanges') }}
              }
            </ion-button>
          </form>
        </section>

        <section class="settings-card" aria-labelledby="password-heading">
          <span class="settings-card-icon"><app-icon name="key" /></span>
          <div>
            <h2 id="password-heading">{{ i.t('passwordSecurity') }}</h2>
            <p class="muted">{{ i.t('passwordSecurityIntro') }}</p>
          </div>
          @if (resetMessage()) {
            <p class="form-message" [class.error]="resetFailed()" role="status">{{ resetMessage() }}</p>
          }
          <ion-button fill="outline" [disabled]="resetBusy()" (click)="sendReset()">
            @if (resetBusy()) {
              <ion-spinner name="crescent" />
            } @else {
              {{ i.t('sendResetLink') }}
            }
          </ion-button>
        </section>
      </div>
    </section>
  `,
})
export class SettingsPage {
  private readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);
  readonly i = inject(I18nService);
  readonly profileBusy = signal(false);
  readonly profileFailed = signal(false);
  readonly profileMessage = signal('');
  readonly resetBusy = signal(false);
  readonly resetFailed = signal(false);
  readonly resetMessage = signal('');
  readonly profileForm = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
  });

  constructor() {
    void this.loadProfile();
  }

  private async loadProfile() {
    await this.auth.waitUntilInitialized();
    this.profileForm.controls.displayName.setValue(this.auth.profile()?.display_name ?? '');
  }

  async saveProfile() {
    if (this.profileForm.invalid || this.profileBusy()) return;
    this.profileBusy.set(true);
    this.profileFailed.set(false);
    this.profileMessage.set('');
    try {
      await this.admin.updateMyProfile(this.profileForm.getRawValue().displayName.trim());
      await this.auth.refreshProfile();
      this.profileMessage.set(this.i.t('profileUpdated'));
    } catch {
      this.profileFailed.set(true);
      this.profileMessage.set(this.i.t('error'));
    } finally {
      this.profileBusy.set(false);
    }
  }

  async sendReset() {
    const email = this.auth.user()?.email;
    if (!email || this.resetBusy()) return;
    this.resetBusy.set(true);
    this.resetFailed.set(false);
    this.resetMessage.set('');
    try {
      const result = await this.auth.resetPassword(email);
      if (result.error) throw result.error;
      this.resetMessage.set(this.i.t('resetEmailSent'));
    } catch {
      this.resetFailed.set(true);
      this.resetMessage.set(this.i.t('unableToSendReset'));
    } finally {
      this.resetBusy.set(false);
    }
  }
}
