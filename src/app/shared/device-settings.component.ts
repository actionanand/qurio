import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, IonButton, IonInput, IonSpinner, IonToggle } from '@ionic/angular';
import { I18nService, type MessageKey } from '../core/i18n.service';
import { ReminderService } from '../core/reminder.service';
import { SecurityService } from '../core/security.service';
import { SnackbarService } from '../core/snackbar.service';
import { AuthService } from '../services/auth.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-device-settings',
  imports: [ReactiveFormsModule, IonButton, IonInput, IonSpinner, IonToggle, IconComponent],
  template: `
    <div class="device-settings-grid">
      <section class="settings-card" aria-labelledby="reminder-heading">
        <span class="settings-card-icon"><app-icon name="notifications" /></span>
        <div>
          <h2 id="reminder-heading">{{ i.t('practiceReminder') }}</h2>
          <p class="muted">{{ i.t(reminders.native ? 'practiceReminderIntro' : 'androidReminderOnly') }}</p>
        </div>
        <div class="setting-row">
          <span>{{ i.t('enableReminder') }}</span>
          <ion-toggle
            [checked]="reminders.settings().enabled"
            [disabled]="busy()"
            [attr.aria-label]="i.t('enableReminder')"
            (ionChange)="reminderChanged($event.detail.checked)" />
        </div>
        <label class="time-field">
          <span>{{ i.t('reminderTime') }}</span>
          <input
            type="time"
            [value]="reminders.settings().time"
            [disabled]="!reminders.settings().enabled || busy()"
            (change)="timeChanged($event)" />
        </label>
        <p id="reminder-days-help" class="muted">{{ i.t('reminderDaysHelp') }}</p>
        <div class="weekday-picker" aria-describedby="reminder-days-help">
          @for (day of weekdays; track day.value) {
            <button
              type="button"
              [class.selected]="reminders.settings().days.includes(day.value)"
              [disabled]="!reminders.settings().enabled || busy()"
              [attr.aria-pressed]="reminders.settings().days.includes(day.value)"
              [attr.aria-label]="i.t(day.name)"
              (click)="toggleDay(day.value)">
              {{ i.t(day.short) }}
            </button>
          }
        </div>
      </section>

      <section class="settings-card" aria-labelledby="app-lock-heading">
        <span class="settings-card-icon"><app-icon name="shield" /></span>
        <div>
          <h2 id="app-lock-heading">{{ i.t('pinAndBiometric') }}</h2>
          <p class="muted">{{ i.t(security.native ? 'androidLockIntro' : 'webLockIntro') }}</p>
        </div>
        <form [formGroup]="pinForm" (ngSubmit)="savePin()">
          @if (security.configured()) {
            <ion-input
              formControlName="current"
              type="password"
              inputmode="numeric"
              maxlength="8"
              [label]="i.t('currentPin')"
              labelPlacement="stacked"
              fill="outline" />
          }
          <ion-input
            formControlName="pin"
            type="password"
            inputmode="numeric"
            maxlength="8"
            [label]="i.t('newPin')"
            [helperText]="i.t('pinHelp')"
            labelPlacement="stacked"
            fill="outline" />
          <ion-input
            formControlName="confirm"
            type="password"
            inputmode="numeric"
            maxlength="8"
            [label]="i.t('confirmPin')"
            labelPlacement="stacked"
            fill="outline" />
          <ion-button type="submit" [disabled]="pinForm.invalid || busy()">
            @if (busy()) {
              <ion-spinner name="crescent" />
            } @else {
              {{ i.t(security.configured() ? 'changePin' : 'enableAppLock') }}
            }
          </ion-button>
        </form>
        @if (security.native) {
          <ion-button fill="outline" [disabled]="!security.configured() || busy()" (click)="enableBiometric()">
            <app-icon name="fingerprint" />
            {{ i.t(security.biometricEnabled() ? 'biometricEnabled' : 'enableBiometric') }}
          </ion-button>
        }
        @if (security.configured()) {
          <ion-button fill="clear" color="danger" [disabled]="busy()" (click)="disableLock()">
            {{ i.t('disableAppLock') }}
          </ion-button>
        }
      </section>
    </div>

    <section class="signout-card">
      <div>
        <h2>{{ i.t('signOut') }}</h2>
        <p class="muted">{{ i.t('signOutIntro') }}</p>
      </div>
      <ion-button color="danger" fill="outline" [disabled]="signingOut()" (click)="signOut()">
        <app-icon name="logout" />{{ i.t('signOut') }}
      </ion-button>
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 18px;
    }
    .device-settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }
    .setting-row,
    .time-field {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .time-field input {
      min-height: 46px;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      color: var(--ion-text-color);
      background: var(--soft);
    }
    .weekday-picker {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
    }
    .weekday-picker button {
      min-width: 0;
      min-height: 40px;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: 11px;
      color: var(--muted);
      background: var(--soft);
    }
    .weekday-picker button.selected {
      border-color: var(--accent);
      color: var(--ion-color-primary-contrast);
      background: var(--accent);
    }
    .signout-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-top: 18px;
      padding: 22px 24px;
      border: 1px solid var(--danger-line);
      border-radius: 20px;
      background: var(--surface);
    }
    h2,
    p {
      margin: 0;
    }
    @media (max-width: 760px) {
      .device-settings-grid {
        grid-template-columns: 1fr;
      }
      .signout-card {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `,
})
export class DeviceSettingsComponent {
  readonly i = inject(I18nService);
  readonly reminders = inject(ReminderService);
  readonly security = inject(SecurityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly alerts = inject(AlertController);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly signingOut = signal(false);
  readonly weekdays: { value: number; short: MessageKey; name: MessageKey }[] = [
    { value: 2, short: 'mondayShort', name: 'monday' },
    { value: 3, short: 'tuesdayShort', name: 'tuesday' },
    { value: 4, short: 'wednesdayShort', name: 'wednesday' },
    { value: 5, short: 'thursdayShort', name: 'thursday' },
    { value: 6, short: 'fridayShort', name: 'friday' },
    { value: 7, short: 'saturdayShort', name: 'saturday' },
    { value: 1, short: 'sundayShort', name: 'sunday' },
  ];
  readonly pinForm = new FormGroup({
    current: new FormControl('', { nonNullable: true }),
    pin: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{4,8}$/)] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    void this.security.initialize(this.auth.user()?.id).catch(() => undefined);
  }

  async reminderChanged(enabled: boolean): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    if (!enabled) {
      await this.reminders.update({ ...this.reminders.settings(), enabled: false });
      this.snackbar.show(this.i.t('reminderDisabled'), 'info');
    } else if (!this.reminders.native) {
      this.snackbar.show(this.i.t('androidReminderOnly'), 'info');
    } else {
      const granted = this.reminders.permissionGranted() || (await this.reminders.requestPermission());
      const saved = granted && (await this.reminders.update({ ...this.reminders.settings(), enabled: true }));
      this.snackbar.show(this.i.t(saved ? 'reminderEnabled' : 'notificationsNotAllowed'), saved ? 'success' : 'error');
    }
    this.busy.set(false);
  }

  async timeChanged(event: Event): Promise<void> {
    const time = (event.target as HTMLInputElement).value;
    await this.saveReminder({ ...this.reminders.settings(), time });
  }

  async toggleDay(day: number): Promise<void> {
    const current = this.reminders.settings();
    const days = current.days.includes(day) ? current.days.filter(value => value !== day) : [...current.days, day];
    if (!days.length) {
      this.snackbar.show(this.i.t('selectReminderDay'), 'error');
      return;
    }
    await this.saveReminder({ ...current, days });
  }

  async savePin(): Promise<void> {
    if (this.pinForm.invalid || this.busy()) return;
    const value = this.pinForm.getRawValue();
    if (value.pin !== value.confirm) {
      this.snackbar.show(this.i.t('pinsDoNotMatch'), 'error');
      return;
    }
    if (this.security.configured() && !(await this.security.verify(value.current))) {
      this.snackbar.show(this.i.t('incorrectPin'), 'error');
      return;
    }
    this.busy.set(true);
    await this.security.setPin(value.pin);
    this.pinForm.reset();
    this.snackbar.show(this.i.t('appLockEnabled'));
    this.busy.set(false);
  }

  async enableBiometric(): Promise<void> {
    const pin = await this.askForPin(this.i.t('enableBiometric'));
    if (!pin) return;
    this.busy.set(true);
    const enabled = await this.security.enableBiometric(pin);
    this.snackbar.show(this.i.t(enabled ? 'biometricEnabled' : 'biometricFailed'), enabled ? 'success' : 'error');
    this.busy.set(false);
  }

  async disableLock(): Promise<void> {
    const pin = await this.askForPin(this.i.t('disableAppLock'));
    if (!pin) return;
    this.busy.set(true);
    const disabled = await this.security.disable(pin);
    this.snackbar.show(this.i.t(disabled ? 'appLockDisabled' : 'incorrectPin'), disabled ? 'success' : 'error');
    this.busy.set(false);
  }

  async signOut(): Promise<void> {
    this.signingOut.set(true);
    await this.auth.signOut();
    this.security.lock();
    await this.router.navigateByUrl('/auth/login');
    this.signingOut.set(false);
  }

  private async saveReminder(settings: Parameters<ReminderService['update']>[0]): Promise<void> {
    this.busy.set(true);
    const saved = await this.reminders.update(settings);
    this.snackbar.show(this.i.t(saved ? 'reminderUpdated' : 'reminderUpdateFailed'), saved ? 'success' : 'error');
    this.busy.set(false);
  }

  private async askForPin(header: string): Promise<string> {
    const alert = await this.alerts.create({
      header,
      message: this.i.t('enterCurrentPin'),
      cssClass: 'qurio-confirmation',
      inputs: [{ name: 'pin', type: 'password', attributes: { inputmode: 'numeric', maxlength: 8 } }],
      buttons: [
        { text: this.i.t('cancel'), role: 'cancel' },
        { text: this.i.t('continue'), role: 'confirm' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss<{ values?: { pin?: string } }>();
    return result.role === 'confirm' ? (result.data?.values?.pin ?? '') : '';
  }
}
