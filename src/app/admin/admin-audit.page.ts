import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonInput, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';
import { AdminService } from '../services/admin.service';
import type { AuditEvent } from '../services/auth.models';
import { IconComponent } from '../shared/icon.component';

@Component({
  imports: [RouterLink, IonInput, IonSelect, IonSelectOption, IonSpinner, IconComponent],
  template: `<section class="admin-page">
    <a class="back-link" routerLink="/admin/users"><app-icon name="back" /> Control Center</a>
    <div class="section-heading">
      <div>
        <p class="eyebrow">Owner only</p>
        <h1>Account audit log</h1>
        <p class="muted">Immutable account lifecycle and administrator actions.</p>
      </div>
    </div>
    <div class="audit-filters">
      <ion-select
        label="Action"
        labelPlacement="stacked"
        interface="popover"
        [value]="action()"
        (ionChange)="setAction($event.detail.value)"
        ><ion-select-option value="all">All actions</ion-select-option>
        @for (value of actions(); track value) {
          <ion-select-option [value]="value">{{ value }}</ion-select-option>
        }</ion-select
      ><ion-input
        label="Actor or target"
        labelPlacement="stacked"
        fill="outline"
        type="search"
        [value]="search()"
        (ionInput)="setSearch($event.detail.value)" /><ion-input
        label="From date"
        labelPlacement="stacked"
        fill="outline"
        type="date"
        [value]="fromDate()"
        (ionInput)="setFromDate($event.detail.value)" />
    </div>
    @if (loading()) {
      <div class="loading-state"><ion-spinner name="crescent" /> Loading audit events…</div>
    } @else {
      <div class="audit-list">
        @for (event of visible(); track event.id) {
          <article class="audit-card">
            <div>
              <span class="status-badge role">{{ event.action }}</span
              ><time>{{ date(event.created_at) }}</time>
            </div>
            <h2>{{ event.target_display_name || event.target_email || 'Deleted account' }}</h2>
            <p>
              By {{ event.actor_email || 'System' }}
              @if (event.actor_role) {
                ({{ event.actor_role }})
              }
            </p>
            @if (event.previous_status || event.new_status) {
              <p>Status: {{ event.previous_status || '—' }} → {{ event.new_status || '—' }}</p>
            }
            @if (event.previous_role || event.new_role) {
              <p>Role: {{ event.previous_role || '—' }} → {{ event.new_role || '—' }}</p>
            }
            @if (event.reason) {
              <p><strong>Reason:</strong> {{ event.reason }}</p>
            }
          </article>
        } @empty {
          <div class="panel empty-state"><h2>No matching events</h2></div>
        }
      </div>
    }
  </section>`,
})
export class AdminAuditPage {
  private readonly admin = inject(AdminService);
  readonly events = signal<AuditEvent[]>([]);
  readonly loading = signal(true);
  readonly action = signal('all');
  readonly search = signal('');
  readonly fromDate = signal('');
  readonly actions = computed(() => [...new Set(this.events().map(event => event.action))].sort());
  readonly visible = computed(() => {
    const query = this.search().toLowerCase();
    const from = this.fromDate() ? new Date(`${this.fromDate()}T00:00:00`).getTime() : 0;
    return this.events().filter(
      event =>
        (this.action() === 'all' || event.action === this.action()) &&
        (!query ||
          [event.actor_email, event.target_email, event.target_display_name].some(value =>
            value?.toLowerCase().includes(query),
          )) &&
        new Date(event.created_at).getTime() >= from,
    );
  });
  constructor() {
    void this.load();
  }
  async load() {
    try {
      this.events.set(await this.admin.listAudit());
    } finally {
      this.loading.set(false);
    }
  }
  setAction(value: unknown) {
    if (typeof value === 'string') this.action.set(value);
  }
  setSearch(value: string | null | undefined) {
    this.search.set(value ?? '');
  }
  setFromDate(value: string | null | undefined) {
    this.fromDate.set(value ?? '');
  }
  date(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
}
