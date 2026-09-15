import { Component, computed, inject, signal } from '@angular/core';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { LearningExperienceService } from '../core/learning-experience.service';
import type { LeaderboardQuery, LeaderboardScope } from '../core/models';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-progress-leaderboard',
  imports: [IconComponent],
  template: `
    <div class="leaderboard-filters">
      @for (option of scopes; track option.value) {
        <button type="button" [class.active]="scope() === option.value" (click)="setScope(option.value)">
          {{ i.t(option.label) }}
        </button>
      }
      @if (scope() !== 'all') {
        <label
          ><span>{{ i.t('grade') }}</span
          ><select [value]="grade() ?? ''" (change)="setGrade($event)">
            @for (value of grades(); track value) {
              <option [value]="value">{{ i.t('class') }} {{ value }}</option>
            }
          </select></label
        >
      }
      @if (scope() === 'subject' || scope() === 'topic') {
        <label
          ><span>{{ i.t('subject') }}</span
          ><select [value]="subject()" (change)="setSubject($event)">
            @for (value of subjects(); track value.id) {
              <option [value]="value.id">{{ value.label }}</option>
            }
          </select></label
        >
      }
      @if (scope() === 'topic') {
        <label
          ><span>{{ i.t('topic') }}</span
          ><select [value]="topic()" (change)="setTopic($event)">
            @for (value of topics(); track value.id) {
              <option [value]="value.id">{{ value.label }}</option>
            }
          </select></label
        >
      }
    </div>
    @if (experience.myRank(); as own) {
      <aside class="my-rank">
        <app-icon name="trophy" /><span>{{ i.t('yourRank') }}</span
        ><strong>#{{ own.rank }}</strong
        ><span>{{ own.points }} {{ i.t('points') }}</span>
      </aside>
    }
    @if (experience.loading()) {
      <p role="status">{{ i.t('loading') }}</p>
    } @else if (experience.error()) {
      <div class="empty-state" role="alert">
        <p>{{ i.t('leaderboardUnavailable') }}</p>
      </div>
    } @else {
      <div class="leaderboard-list">
        @for (row of experience.leaderboard(); track row.rank) {
          <article class="leaderboard-row" [class.podium]="row.rank <= 3" [class.current]="row.isCurrentUser">
            <strong class="rank">#{{ row.rank }}</strong>
            <div>
              <h3>{{ row.displayName }}</h3>
              <span>{{ row.quizzesCompleted }} {{ i.t('quizzesCompleted') }}</span>
            </div>
            <div class="leaderboard-score">
              <strong>{{ row.points }}</strong
              ><span>{{ i.t('points') }}</span>
            </div>
            <div class="leaderboard-score">
              <strong>{{ row.averageScore }}%</strong><span>{{ i.t('average') }}</span>
            </div>
          </article>
        } @empty {
          <div class="empty-state">
            <app-icon name="trophy" />
            <p>{{ i.t('noLeaderboard') }}</p>
          </div>
        }
      </div>
    }
  `,
})
export class ProgressLeaderboardComponent {
  readonly i = inject(I18nService);
  readonly experience = inject(LearningExperienceService);
  private readonly content = inject(ContentService);
  readonly scope = signal<LeaderboardScope>('all');
  readonly grade = signal<number | undefined>(undefined);
  readonly subject = signal('');
  readonly topic = signal('');
  readonly scopes = [
    { value: 'all' as const, label: 'overall' as const },
    { value: 'grade' as const, label: 'grade' as const },
    { value: 'subject' as const, label: 'subject' as const },
    { value: 'topic' as const, label: 'topic' as const },
  ];
  readonly grades = computed(() =>
    [
      ...new Set(
        (this.content.manifest()?.items ?? [])
          .filter(item => item.type === 'quiz' && item.grade !== undefined)
          .map(item => item.grade as number),
      ),
    ].sort((a, b) => a - b),
  );
  readonly subjects = computed(() => {
    const grade = this.grade();
    const ids = new Set(
      (this.content.manifest()?.items ?? [])
        .filter(item => item.type === 'quiz' && (!grade || item.grade === grade) && item.subject)
        .map(item => item.subject as string),
    );
    return [...ids].map(id => ({ id, label: this.content.getSubjectLabel(id, this.i.preferences.language()) }));
  });
  readonly topics = computed(() => {
    const grade = this.grade(),
      subject = this.subject();
    const ids = new Set(
      (this.content.manifest()?.items ?? [])
        .filter(
          item =>
            item.type === 'quiz' &&
            (!grade || item.grade === grade) &&
            (!subject || item.subject === subject) &&
            item.topic,
        )
        .map(item => item.topic as string),
    );
    return [...ids].map(id => ({ id, label: readable(id) })).sort((a, b) => a.label.localeCompare(b.label));
  });

  constructor() {
    void this.load();
  }
  setScope(scope: LeaderboardScope): void {
    this.scope.set(scope);
    if (scope !== 'all' && !this.grade()) this.grade.set(this.grades()[0]);
    this.syncSelections();
    void this.load();
  }
  setGrade(event: Event): void {
    this.grade.set(Number((event.target as HTMLSelectElement).value));
    this.syncSelections();
    void this.load();
  }
  setSubject(event: Event): void {
    this.subject.set((event.target as HTMLSelectElement).value);
    this.syncSelections();
    void this.load();
  }
  setTopic(event: Event): void {
    this.topic.set((event.target as HTMLSelectElement).value);
    void this.load();
  }
  private syncSelections(): void {
    if (
      (this.scope() === 'subject' || this.scope() === 'topic') &&
      !this.subjects().some(value => value.id === this.subject())
    )
      this.subject.set(this.subjects()[0]?.id ?? '');
    if (this.scope() === 'topic' && !this.topics().some(value => value.id === this.topic()))
      this.topic.set(this.topics()[0]?.id ?? '');
  }
  private load(): Promise<void> {
    const query: LeaderboardQuery = { scope: this.scope() };
    if (this.scope() !== 'all') query.grade = this.grade();
    if (this.scope() === 'subject' || this.scope() === 'topic') query.subject = this.subject() || undefined;
    if (this.scope() === 'topic') query.topic = this.topic() || undefined;
    if (
      (query.scope !== 'all' && !query.grade) ||
      (query.scope === 'subject' && !query.subject) ||
      (query.scope === 'topic' && !query.topic)
    )
      return Promise.resolve();
    return this.experience.loadLeaderboard(query);
  }
}

function readable(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}
