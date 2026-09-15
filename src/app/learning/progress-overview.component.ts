import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { LearningExperienceService } from '../core/learning-experience.service';
import type { Attempt } from '../core/models';
import { ProgressService } from '../core/progress.service';

const pageSize = 10;

@Component({
  selector: 'app-progress-overview',
  imports: [DatePipe, DecimalPipe, RouterLink],
  template: `
    <p class="muted section-intro">{{ i.t('progressOverviewIntro') }}</p>
    @if ((experience.overviewLoading() && !experience.overviewLoaded()) || (progress.loading() && !progress.loaded())) {
      <p class="progress-message" role="status">{{ i.t('loading') }}</p>
    } @else {
      @if (experience.overviewError() || progress.error()) {
        <p class="progress-message error" role="alert">{{ i.t('progressUnavailable') }}</p>
      }
      @if (experience.overviewLoaded()) {
        <div class="progress-stats">
          @for (stat of stats(); track stat.label) {
            <article class="stat-card">
              <strong>{{ stat.value }}</strong
              ><span>{{ stat.label }}</span>
            </article>
          }
        </div>
      }
      <h2>{{ i.t('recent') }}</h2>
      <div class="content-list history-list">
        @for (attempt of visibleAttempts(); track attempt.id) {
          <article class="content-card history-card">
            <div class="history-copy">
              <div class="history-title">
                <a [routerLink]="['/content', attempt.quizId]"
                  ><h3>{{ title(attempt.quizId, attempt.title) }}</h3></a
                >
                @if (isBest(attempt)) {
                  <span class="status-badge best-badge">{{ i.t('best') }}</span>
                }
              </div>
              <p class="muted">{{ attempt.completedAt | date: 'medium' }} · {{ duration(attempt.elapsedSeconds) }}</p>
              <div class="history-meta">
                <span>{{ attempt.correct }}/{{ attempt.total }} {{ i.t('correct') }}</span>
                <span class="status-badge" [class.needs-practice]="!attempt.passed">
                  {{ i.t(attempt.passed ? 'passedShort' : 'needsPractice') }}
                </span>
                @if (progress.syncState(attempt.id) === 'pending') {
                  <span class="sync-state" role="status">{{ i.t('pendingSync') }}</span>
                } @else if (progress.syncState(attempt.id) === 'failed') {
                  <span class="sync-state failed">{{ i.t('syncFailed') }}</span>
                  <button type="button" class="link-button" (click)="progress.retryAttemptSync(attempt.id)">
                    {{ i.t('retry') }}
                  </button>
                }
              </div>
            </div>
            <strong class="attempt-score" [class.not-passed]="!attempt.passed">
              {{ attempt.scorePercentage | number: '1.0-0' }}%
            </strong>
          </article>
        } @empty {
          <div class="panel">
            <p>{{ i.t('noProgress') }}</p>
          </div>
        }
      </div>
      @if (visibleCount() < progress.attempts().length) {
        <button type="button" class="secondary-button view-more" (click)="showMore()">{{ i.t('viewMore') }}</button>
      }
      @if (progress.legacyAttempts().length) {
        <details class="legacy-history">
          <summary>{{ i.t('deviceOnlyHistory') }} ({{ progress.legacyAttempts().length }})</summary>
          <p class="muted">{{ i.t('recordedOnDevice') }}</p>
          <div class="content-list">
            @for (attempt of progress.legacyAttempts(); track attempt.id) {
              <article class="legacy-attempt">
                <strong>{{ title(attempt.quizId, attempt.title) }}</strong>
                <span
                  >{{ attempt.completedAt | date: 'medium' }} · {{ attempt.scorePercentage | number: '1.0-0' }}%</span
                >
              </article>
            }
          </div>
        </details>
      }
    }
  `,
})
export class ProgressOverviewComponent {
  readonly i = inject(I18nService);
  readonly progress = inject(ProgressService);
  readonly experience = inject(LearningExperienceService);
  private readonly content = inject(ContentService);
  readonly visibleCount = signal(pageSize);
  readonly visibleAttempts = computed(() => this.progress.attempts().slice(0, this.visibleCount()));
  readonly bestScores = computed(() => {
    const scores = new Map<string, number>();
    for (const attempt of this.progress.attempts())
      scores.set(
        attempt.quizId,
        Math.max(scores.get(attempt.quizId) ?? Number.NEGATIVE_INFINITY, attempt.scorePercentage),
      );
    return scores;
  });
  readonly stats = computed(() => {
    const summary = this.experience.summary();
    return [
      { label: this.i.t('lessonsStarted'), value: summary.lessonsStarted },
      { label: this.i.t('notesDone'), value: summary.lessonsCompleted },
      { label: this.i.t('attempts'), value: summary.quizAttempts },
      { label: this.i.t('uniqueQuizzes'), value: summary.uniqueQuizzesAttempted },
      { label: this.i.t('average'), value: `${summary.averageScore}%` },
      { label: this.i.t('bestScore'), value: `${summary.bestScore}%` },
      { label: this.i.t('correctAnswers'), value: summary.correctAnswers },
      { label: this.i.t('wrongAnswers'), value: summary.wrongAnswers },
    ];
  });

  constructor() {
    effect(() => {
      this.progress.canonicalRevision();
      void this.experience.loadOverview().catch(() => undefined);
    });
  }

  showMore(): void {
    this.visibleCount.update(value => value + pageSize);
  }

  isBest(attempt: Attempt): boolean {
    return attempt.scorePercentage === this.bestScores().get(attempt.quizId);
  }

  duration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
  }

  title(id: string, fallback?: string): string {
    const info = this.content.getContentDisplayInfo(id, this.i.preferences.language());
    return info.unavailable ? (fallback ?? this.i.t('contentUnavailable')) : info.title;
  }
}
