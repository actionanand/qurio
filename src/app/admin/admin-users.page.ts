import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonButton, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';
import { AdminService } from '../services/admin.service';
import { AuthService } from '../services/auth.service';
import type { UserProfile } from '../services/auth.models';
import { IconComponent } from '../shared/icon.component';

type UserFilter = 'pending' | 'unverified' | 'approved' | 'denied' | 'suspended' | 'all';

@Component({
  imports: [RouterLink, IonButton, IonSelect, IonSelectOption, IonSpinner, IconComponent],
  template: `
    <section class="admin-page">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Administration</p>
          <h1>Admin Control Center</h1>
          <p class="muted">Review account verification, approval, and roles.</p>
        </div>
        @if (auth.isOwner()) {
          <a class="button secondary" routerLink="/admin/audit"><app-icon name="shield" /> Audit log</a>
        }
      </div>
      <div class="admin-toolbar">
        <ion-select
          label="Accounts"
          labelPlacement="stacked"
          interface="popover"
          [value]="filter()"
          (ionChange)="setFilter($event.detail.value)">
          @for (option of filters; track option.value) {
            <ion-select-option [value]="option.value">{{ option.label }}</ion-select-option>
          }
        </ion-select>
        <div class="admin-count">
          <strong>{{ adminCount() }} / 3</strong><span>Admin accounts</span>
        </div>
        <ion-button fill="outline" [disabled]="loading()" (click)="load()">Refresh</ion-button>
      </div>
      @if (error()) {
        <p class="notice error" role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <div class="loading-state"><ion-spinner name="crescent" /><span>Loading accounts…</span></div>
      } @else {
        <div class="account-list">
          @for (profile of visibleProfiles(); track profile.id) {
            <article class="account-card">
              <div class="account-main">
                <div class="account-avatar">{{ initials(profile) }}</div>
                <div>
                  <h2>{{ profile.display_name || 'Unnamed account' }}</h2>
                  <p>{{ profile.email }}</p>
                  <div class="account-badges">
                    <span [class]="'status-badge ' + profile.status">{{ profile.status }}</span
                    ><span class="status-badge role">{{ profile.role }}</span
                    ><span class="status-badge" [class.approved]="profile.email_verified_at">{{
                      profile.email_verified_at ? 'Email verified' : 'Email unverified'
                    }}</span>
                  </div>
                </div>
              </div>
              <dl class="account-details">
                <div>
                  <dt>Signed up</dt>
                  <dd>{{ date(profile.created_at) }}</dd>
                </div>
                <div>
                  <dt>Status changed</dt>
                  <dd>{{ date(profile.status_changed_at) }}</dd>
                </div>
                @if (profile.status_reason) {
                  <div>
                    <dt>Reason</dt>
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
                      >Approve</ion-button
                    >
                  }
                  @if (!profile.email_verified_at && profile.status === 'pending') {
                    <ion-button
                      size="small"
                      fill="outline"
                      [disabled]="acting() === profile.id"
                      (click)="perform(profile, 'resend')"
                      >Resend verification</ion-button
                    >
                  }
                  @if (profile.status !== 'denied') {
                    <ion-button
                      size="small"
                      fill="outline"
                      color="warning"
                      [disabled]="acting() === profile.id"
                      (click)="perform(profile, 'deny')"
                      >Deny</ion-button
                    >
                  }
                  @if (profile.status === 'approved') {
                    <ion-button
                      size="small"
                      fill="outline"
                      color="danger"
                      [disabled]="acting() === profile.id"
                      (click)="perform(profile, 'suspend')"
                      >Suspend</ion-button
                    >
                  }
                  @if (profile.status === 'suspended' || profile.status === 'denied') {
                    <ion-button
                      size="small"
                      fill="outline"
                      [disabled]="acting() === profile.id"
                      (click)="perform(profile, 'reactivate')"
                      >Reactivate</ion-button
                    >
                  }
                  @if (auth.isOwner() && profile.status === 'approved') {
                    <ion-button
                      size="small"
                      fill="outline"
                      [disabled]="adminCount() >= 3 || acting() === profile.id"
                      (click)="perform(profile, 'promote')"
                      >Promote to Admin</ion-button
                    >
                  }
                  <ion-button
                    size="small"
                    fill="clear"
                    color="danger"
                    [disabled]="acting() === profile.id"
                    (click)="perform(profile, 'delete')"
                    ><app-icon name="trash" /> Delete</ion-button
                  >
                } @else if (auth.isOwner() && profile.role === 'admin') {
                  <ion-button
                    size="small"
                    fill="outline"
                    color="warning"
                    [disabled]="acting() === profile.id"
                    (click)="perform(profile, 'demote')"
                    >Demote Admin</ion-button
                  >
                  <ion-button
                    size="small"
                    fill="clear"
                    color="danger"
                    [disabled]="acting() === profile.id"
                    (click)="perform(profile, 'delete')"
                    ><app-icon name="trash" /> Delete</ion-button
                  >
                }
              </div>
            </article>
          } @empty {
            <div class="panel empty-state">
              <app-icon name="people" />
              <h2>No accounts in this view</h2>
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
  readonly profiles = signal<UserProfile[]>([]);
  readonly filter = signal<UserFilter>('pending');
  readonly loading = signal(true);
  readonly acting = signal<string | null>(null);
  readonly error = signal('');
  readonly filters: { value: UserFilter; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'unverified', label: 'Unverified' },
    { value: 'approved', label: 'Approved' },
    { value: 'denied', label: 'Denied' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'all', label: 'All' },
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
    } catch {
      this.error.set('Unable to load accounts. Check the database migration and try again.');
    } finally {
      this.loading.set(false);
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
  async perform(
    profile: UserProfile,
    action: 'approve' | 'deny' | 'suspend' | 'reactivate' | 'promote' | 'demote' | 'delete' | 'resend',
  ) {
    const needsReason = ['deny', 'suspend', 'demote', 'delete'].includes(action);
    const destructive = ['deny', 'suspend', 'demote', 'delete'].includes(action);
    const alert = await this.alerts.create({
      header: `${action[0].toUpperCase()}${action.slice(1)} ${profile.display_name || profile.email}?`,
      message: destructive
        ? 'This changes account access and will be recorded in the audit log.'
        : 'This action will be recorded in the audit log.',
      inputs: needsReason ? [{ name: 'reason', type: 'textarea', placeholder: 'Reason' }] : [],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Continue', role: 'confirm' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'confirm') return;
    const reason = typeof result.data?.values?.reason === 'string' ? result.data.values.reason.trim() : '';
    if (needsReason && !reason) {
      this.error.set('A reason is required for that action.');
      return;
    }
    this.acting.set(profile.id);
    this.error.set('');
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
    if (message.includes('Email must be verified')) return 'Email must be verified before approval.';
    if (message.includes('Maximum of 3')) return 'The maximum of three Admin accounts has been reached.';
    if (message.includes('Reason is required')) return 'A reason is required for that action.';
    return 'The account action could not be completed. Refresh the list and try again.';
  }
}
