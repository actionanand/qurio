import { Component, inject, signal } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { IconComponent } from '../shared/icon.component';
import { ProgressBookmarksComponent } from './progress-bookmarks.component';
import { ProgressLeaderboardComponent } from './progress-leaderboard.component';
import { ProgressMistakesComponent } from './progress-mistakes.component';
import { ProgressOverviewComponent } from './progress-overview.component';

type ProgressTab = 'overview' | 'mistakes' | 'leaderboard' | 'bookmarks';
export const progressTabs = [
  { id: 'overview', label: 'overview', icon: 'progress' },
  { id: 'mistakes', label: 'mistakes', icon: 'warning' },
  { id: 'leaderboard', label: 'leaderboard', icon: 'trophy' },
  { id: 'bookmarks', label: 'bookmarks', icon: 'bookmark' },
] as const satisfies readonly {
  id: ProgressTab;
  label: 'overview' | 'mistakes' | 'leaderboard' | 'bookmarks';
  icon: 'progress' | 'warning' | 'trophy' | 'bookmark';
}[];

@Component({
  selector: 'app-progress',
  imports: [
    IconComponent,
    ProgressOverviewComponent,
    ProgressMistakesComponent,
    ProgressLeaderboardComponent,
    ProgressBookmarksComponent,
  ],
  template: `
    <span class="eyebrow">QURIO · {{ i.t('progress') }}</span>
    <h1>{{ i.t('progress') }}</h1>
    <nav class="progress-tabs" [attr.aria-label]="i.t('progress')">
      @for (item of tabs; track item.id) {
        <button
          type="button"
          [class.active]="tab() === item.id"
          [attr.aria-current]="tab() === item.id ? 'page' : null"
          (click)="tab.set(item.id)">
          <app-icon [name]="item.icon" />{{ i.t(item.label) }}
        </button>
      }
    </nav>
    <section class="progress-section">
      @switch (tab()) {
        @case ('overview') {
          <app-progress-overview />
        }
        @case ('mistakes') {
          <app-progress-mistakes />
        }
        @case ('leaderboard') {
          <app-progress-leaderboard />
        }
        @case ('bookmarks') {
          <app-progress-bookmarks />
        }
      }
    </section>
  `,
})
export class ProgressPage {
  readonly i = inject(I18nService);
  readonly tab = signal<ProgressTab>('overview');
  readonly tabs = progressTabs;
}
