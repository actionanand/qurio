import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonButton, IonSelect, IonSelectOption, IonSpinner, IonToggle } from '@ionic/angular';
import { I18nService, type MessageKey } from '../core/i18n.service';
import { AdminService } from '../services/admin.service';
import { AuthService } from '../services/auth.service';
import type { UserProfile } from '../services/auth.models';
import { IconComponent } from '../shared/icon.component';

type UserFilter = 'pending' | 'unverified' | 'approved' | 'denied' | 'suspended' | 'all';
type AdminAction = 'approve' | 'deny' | 'suspend' | 'reactivate' | 'promote' | 'demote' | 'delete' | 'resend';

@Component({
  imports: [RouterLink, IonButton, IonSelect, IonSelectOption, IonSpinner, IonToggle, IconComponent],
  template: `
    <section class="admin-page">
      <div class="section-heading">
        <div>
          <p class="eyebrow">{{ i.t('administration') }}</p>
          <h1>{{ i.t('adminControlCenter') }}</h1>
          <p class="muted">{{ i.t('adminIntro') }}</p>
        </div>
        @if (auth.profile(); as current) {
          <div class="admin-heading-actions">
            <div class="admin-identity" [attr.aria-label]="i.t('currentAdministrator')">
              <span class="account-avatar">{{ initials(current) }}</span>
              <span class="admin-identity-copy">
                <span
                  ><strong>{{ current.display_name }}</strong
                  ><span class="owner-badge">{{ i.t(auth.isOwner() ? 'owner' : 'admin') }}</span></span
                >
                <small>{{ current.email }}</small>
              </span>
            </div>
            <ion-button
              class="security-link"
              fill="outline"
              [disabled]="acting() === current.id"
              (click)="sendPasswordReset(current)">
              <app-icon name="key" />{{ i.t('sendPasswordReset') }}
            </ion-button>
            @if (auth.isOwner()) {
              <a class="button secondary audit-link" routerLink="/admin/audit"
                ><app-icon name="shield" /> {{ i.t('auditLog') }}</a
              >
            }
          </div>
        }
      </div>
      @if (auth.isOwner()) {
        <section class="policy-card" aria-labelledby="auto-approval-heading">
          <span class="policy-icon"><app-icon name="correct" /></span>
          <div class="policy-copy">
            <span class="owner-badge">{{ i.t('ownerControl') }}</span>
            <h2 id="auto-approval-heading">{{ i.t('automaticApproval') }}</h2>
            <p>{{ i.t('automaticApprovalDescription') }}</p>
          </div>
          <div class="policy-toggle">
            <ion-toggle
              [attr.aria-label]="i.t('automaticApprovalAria')"
              [checked]="autoApproval()"
              [disabled]="settingsBusy()"
              (ionChange)="changeAutoApproval($event.detail.checked)"
              >{{ i.t(autoApproval() ? 'on' : 'off') }}</ion-toggle
            >
          </div>
        </section>
      }
      <div class="admin-toolbar">
        <ion-select
          [label]="i.t('accounts')"
          labelPlacement="stacked"
          interface="popover"
          [value]="filter()"
          (ionChange)="setFilter($event.detail.value)">
          @for (option of filters; track option.value) {
            <ion-select-option [value]="option.value">{{ i.t(option.label) }}</ion-select-option>
          }
        </ion-select>
        <div class="admin-count">
          <strong>{{ adminCount() }} / 3</strong><span>{{ i.t('adminAccounts') }}</span>
        </div>
        <ion-button fill="outline" [disabled]="loading()" (click)="load()">{{ i.t('refresh') }}</ion-button>
      </div>
      @if (error()) {
        <p class="notice error" role="alert">{{ error() }}</p>
      }
      @if (statusMessage()) {
        <p class="notice" role="status">{{ statusMessage() }}</p>
      }
      @if (loading()) {
        <div class="loading-state">
          <ion-spinner name="crescent" /><span>{{ i.t('loadingAccounts') }}</span>
        </div>
      } @else {
        <div class="account-list">
          @for (profile of visibleProfiles(); track profile.id) {
            <article class="account-card">
              <div class="account-main">
                <div class="account-avatar">{{ initials(profile) }}</div>
                <div>
                  <h2>{{ profile.display_name || i.t('unnamedAccount') }}</h2>
                  <p>{{ profile.email }}</p>
                  <div class="account-badges">
                    <span [class]="'status-badge ' + profile.status">{{ i.t(statusKey(profile.status)) }}</span
                    ><span class="status-badge role">{{ i.t(roleKey(profile.role)) }}</span
                    ><span class="status-badge" [class.approved]="profile.email_verified_at">{{
                      profile.email_verified_at ? i.t('emailVerified') : i.t('emailUnverified')
                    }}</span>
                  </div>
                </div>
              </div>
              <dl class="account-details">
                <div>
                  <dt>{{ i.t('signedUp') }}</dt>
                  <dd>{{ date(profile.created_at) }}</dd>
                </div>
                <div>
                  <dt>{{ i.t('statusChanged') }}</dt>
                  <dd>{{ date(profile.status_changed_at) }}</dd>
                </div>
                @if (profile.status_reason) {
                  <div>
                    <dt>{{ i.t('reason') }}</dt>
                    <dd>{{ profile.status_reason }}</dd>
                  </div>
                }
              </dl>
              <div class="account-actions">
                @if (profile.role === 'user') {
                  @if (profile.status !== 'approved') {
                    <ion-button
                      size="small"
                      [disabled]="!profile.email_verified_at || acting() === profile.id"
                      (click)="perform(profile, 'approve')"
                      >{{ i.t('approve') }}</ion-button
                    >
                  }
                  @if (!profile.email_verified_at && profile.status === 'pending') {
                    <ion-button
                      size="small"
                      fill="outline"
                      [disabled]="acting() === profile.id"
                      (click)="perform(profile, 'resend')"
                      >{{ i.t('resendVerification') }}</ion-button
                    >
                  }
                  @if (profile.status !== 'denied') {
                    <ion-button
                      size="small"
                      fill="outline"
                      color="warning"
                      [disabled]="acting() === profile.id"
                      (click)="perform(profile, 'deny')"
                      >{{ i.t('deny') }}</ion-button
                    >
                  }
                  @if (profile.status === 'approved') {
                    <ion-button
                      size="small"
                      fill="outline"
                      color="danger"
                      [disabled]="acting() === profile.id"
                      (click)="perform(profile, 'suspend')"
                      >{{ i.t('suspend') }}</ion-button
                    >
                  }
                  @if (profile.status === 'suspended' || profile.status === 'denied') {
                    <ion-button
                      size="small"
                      fill="outline"
                      [disabled]="acting() === profile.id"
                      (click)="perform(profile, 'reactivate')"
                      >{{ i.t('reactivate') }}</ion-button
                    >
                  }
                  @if (auth.isOwner() && profile.status === 'approved') {
                    <ion-button
                      size="small"
                      fill="outline"
                      [disabled]="adminCount() >= 3 || acting() === profile.id"
                      (click)="perform(profile, 'promote')"
                      >{{ i.t('promoteAdmin') }}</ion-button
                    >
                  }
                  <ion-button
                    size="small"
                    fill="clear"
                    color="danger"
                    [disabled]="acting() === profile.id"
                    (click)="perform(profile, 'delete')"
                    ><app-icon name="trash" /> {{ i.t('delete') }}</ion-button
                  >
                  <ion-button
                    size="small"
                    fill="outline"
                    [disabled]="acting() === profile.id"
                    (click)="sendPasswordReset(profile)">
                    <app-icon name="key" />{{ i.t('sendPasswordReset') }}
                  </ion-button>
                } @else if (auth.isOwner() && profile.role === 'admin') {
                  <ion-button
                    size="small"
                    fill="outline"
                    color="warning"
                    [disabled]="acting() === profile.id"
                    (click)="perform(profile, 'demote')"
                    >{{ i.t('demoteAdmin') }}</ion-button
                  >
                  <ion-button
                    size="small"
                    fill="clear"
                    color="danger"
                    [disabled]="acting() === profile.id"
                    (click)="perform(profile, 'delete')"
                    ><app-icon name="trash" /> {{ i.t('delete') }}</ion-button
                  >
                  <ion-button
                    size="small"
                    fill="outline"
                    [disabled]="acting() === profile.id"
                    (click)="sendPasswordReset(profile)">
                    <app-icon name="key" />{{ i.t('sendPasswordReset') }}
                  </ion-button>
                }
              </div>
            </article>
          } @empty {
            <div class="panel empty-state">
              <app-icon name="people" />
              <h2>{{ i.t('noAccounts') }}</h2>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class AdminUsersPage {
  private readonly admin = inject(AdminService);
  private readonly alerts = inject(AlertController);
  readonly auth = inject(AuthService);
  readonly i = inject(I18nService);
  readonly profiles = signal<UserProfile[]>([]);
  readonly filter = signal<UserFilter>('pending');
  readonly loading = signal(true);
  readonly acting = signal<string | null>(null);
  readonly autoApproval = signal(false);
  readonly settingsBusy = signal(false);
  readonly error = signal('');
  readonly statusMessage = signal('');
  readonly filters: { value: UserFilter; label: MessageKey }[] = [
    { value: 'pending', label: 'pending' },
    { value: 'unverified', label: 'unverified' },
    { value: 'approved', label: 'approved' },
    { value: 'denied', label: 'denied' },
    { value: 'suspended', label: 'suspended' },
    { value: 'all', label: 'all' },
  ];
  readonly adminCount = computed(() => this.profiles().filter(profile => profile.role === 'admin').length);
  readonly visibleProfiles = computed(() =>
    this.profiles().filter(
      profile =>
        this.filter() === 'all' ||
        (this.filter() === 'unverified' ? !profile.email_verified_at : profile.status === this.filter()),
    ),
  );
  constructor() {
    void this.load();
  }
  setFilter(value: unknown) {
    if (typeof value === 'string' && this.filters.some(option => option.value === value))
      this.filter.set(value as UserFilter);
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.profiles.set(await this.admin.listProfiles());
      if (this.auth.isOwner()) {
        try {
          const settings = await this.admin.getAppSettings();
          this.autoApproval.set(settings.auto_approve_verified_users);
        } catch {
          this.error.set(this.i.t('accountsLoadedMigrationNeeded'));
        }
      }
    } catch {
      this.error.set(this.i.t('unableToLoadAccounts'));
    } finally {
      this.loading.set(false);
    }
  }
  async sendPasswordReset(profile: UserProfile) {
    if (this.acting()) return;
    const alert = await this.alerts.create({
      header: this.i.t('sendPasswordReset'),
      message: `${this.i.t('passwordResetConfirm')} ${profile.email}?`,
      buttons: [
        { text: this.i.t('cancel'), role: 'cancel' },
        { text: this.i.t('continue'), role: 'confirm' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'confirm') return;
    this.acting.set(profile.id);
    this.error.set('');
    this.statusMessage.set('');
    try {
      const reset = await this.auth.resetPassword(profile.email);
      if (reset.error) throw reset.error;
      this.statusMessage.set(this.i.t('resetEmailSent'));
    } catch {
      this.error.set(this.i.t('unableToSendReset'));
    } finally {
      this.acting.set(null);
    }
  }
  async changeAutoApproval(enabled: boolean) {
    if (enabled === this.autoApproval() || this.settingsBusy()) return;
    this.settingsBusy.set(true);
    this.error.set('');
    try {
      await this.admin.setAutoApproval(enabled);
      this.autoApproval.set(enabled);
      await this.load();
    } catch {
      this.error.set(this.i.t('unableToChangeAutoApproval'));
    } finally {
      this.settingsBusy.set(false);
    }
  }
  initials(profile: UserProfile) {
    return (profile.display_name || profile.email)
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('');
  }
  date(value: string | null) {
    return value
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
      : '—';
  }
  statusKey(status: UserProfile['status']): MessageKey {
    return status;
  }
  roleKey(role: UserProfile['role']): MessageKey {
    return role;
  }
  actionKey(action: AdminAction): MessageKey {
    return {
      approve: 'approve',
      deny: 'deny',
      suspend: 'suspend',
      reactivate: 'reactivate',
      promote: 'promoteAdmin',
      demote: 'demoteAdmin',
      delete: 'delete',
      resend: 'resendVerification',
    }[action] as MessageKey;
  }
  async perform(profile: UserProfile, action: AdminAction) {
    const needsReason = ['deny', 'suspend', 'demote', 'delete'].includes(action);
    const destructive = ['deny', 'suspend', 'demote', 'delete'].includes(action);
    const alert = await this.alerts.create({
      header: `${this.i.t(this.actionKey(action))} ${profile.display_name || profile.email}?`,
      message: this.i.t(destructive ? 'accessActionNotice' : 'accountActionNotice'),
      inputs: needsReason ? [{ name: 'reason', type: 'textarea', placeholder: this.i.t('reason') }] : [],
      buttons: [
        { text: this.i.t('cancel'), role: 'cancel' },
        { text: this.i.t('continue'), role: 'confirm' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'confirm') return;
    const reason = typeof result.data?.values?.reason === 'string' ? result.data.values.reason.trim() : '';
    if (needsReason && !reason) {
      this.error.set(this.i.t('reasonRequired'));
      return;
    }
    this.acting.set(profile.id);
    this.error.set('');
    this.statusMessage.set('');
    try {
      if (action === 'approve') await this.admin.approve(profile.id);
      else if (action === 'deny') await this.admin.deny(profile.id, reason);
      else if (action === 'suspend') await this.admin.suspend(profile.id, reason);
      else if (action === 'reactivate') await this.admin.reactivate(profile.id, reason);
      else if (action === 'promote') await this.admin.promote(profile.id);
      else if (action === 'demote') await this.admin.demote(profile.id, reason);
      else if (action === 'delete') await this.admin.deleteUser(profile.id, reason);
      else await this.admin.resendVerification(profile.id);
      await this.load();
    } catch (error) {
      this.error.set(this.safeActionError(error));
    } finally {
      this.acting.set(null);
    }
  }

  private safeActionError(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Email must be verified')) return this.i.t('emailRequiredForApproval');
    if (message.includes('Maximum of 3')) return this.i.t('maximumAdminsReached');
    if (message.includes('Reason is required')) return this.i.t('reasonRequired');
    return this.i.t('accountActionFailed');
  }
}
