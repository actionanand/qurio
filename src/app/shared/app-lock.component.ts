import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { I18nService } from '../core/i18n.service';
import { SecurityService } from '../core/security.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-lock',
  imports: [NgOptimizedImage, ReactiveFormsModule, IonButton, IonInput, IonSpinner, IconComponent],
  template: `
    @if (security.configured() && !security.unlocked()) {
      <div class="lock-backdrop" role="dialog" aria-modal="true" aria-labelledby="lock-title">
        <section class="lock-card">
          <img ngSrc="assets/qurio.png" width="76" height="76" alt="" priority />
          <span class="eyebrow">QURIO</span>
          <h1 id="lock-title">{{ i.t('qurioLocked') }}</h1>
          <p>{{ i.t('enterPinToUnlock') }}</p>
          <form (ngSubmit)="unlock()">
            <ion-input
              [formControl]="pin"
              type="password"
              inputmode="numeric"
              maxlength="8"
              [label]="i.t('pin')"
              labelPlacement="stacked"
              fill="outline" />
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <ion-button expand="block" type="submit" [disabled]="busy() || pin.invalid">
              @if (busy()) {
                <ion-spinner name="crescent" />
              } @else {
                <app-icon name="key" />{{ i.t('unlock') }}
              }
            </ion-button>
            @if (security.biometricEnabled()) {
              <ion-button expand="block" fill="clear" type="button" [disabled]="busy()" (click)="biometric()">
                <app-icon name="fingerprint" />{{ i.t('unlockWithBiometric') }}
              </ion-button>
            }
          </form>
        </section>
      </div>
    }
  `,
  styles: `
    .lock-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: grid;
      place-items: center;
      padding: 20px;
      background: var(--ion-background-color);
    }
    .lock-card {
      width: min(100%, 430px);
      padding: 34px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--surface);
      box-shadow: 0 24px 70px #071b1230;
      text-align: center;
    }
    img {
      display: block;
      margin: 0 auto 14px;
      object-fit: contain;
    }
    h1 {
      margin: 8px 0;
    }
    .lock-card > p {
      margin: 0 0 22px;
      color: var(--muted);
    }
    form {
      display: grid;
      gap: 12px;
    }
    .error {
      margin: 0;
      color: var(--danger);
    }
    @media (max-width: 520px) {
      .lock-card {
        padding: 28px 20px;
        border-radius: 20px;
      }
    }
  `,
})
export class AppLockComponent {
  readonly security = inject(SecurityService);
  readonly i = inject(I18nService);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly pin = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{4,8}$/)],
  });

  async unlock(): Promise<void> {
    if (this.pin.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    if (!(await this.security.verify(this.pin.value))) {
      this.error.set(this.i.t('incorrectPin'));
      this.pin.reset();
    }
    this.busy.set(false);
  }

  async biometric(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    if (!(await this.security.authenticateBiometric())) this.error.set(this.i.t('biometricFailed'));
    this.busy.set(false);
  }
}
