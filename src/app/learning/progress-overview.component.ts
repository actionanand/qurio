import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { LearningExperienceService } from '../core/learning-experience.service';
import { ProgressService } from '../core/progress.service';

@Component({
  selector: 'app-progress-overview',
  imports: [DatePipe, DecimalPipe, RouterLink],
  template: `
    <p class="muted section-intro">{{ i.t('progressOverviewIntro') }}</p>
    <div class="progress-stats">
      @for (stat of stats(); track stat.label) {
        <article class="stat-card">
          <strong>{{ stat.value }}</strong
          ><span>{{ stat.label }}</span>
        </article>
      }
    </div>
    <h2>{{ i.t('recent') }}</h2>
    <div class="content-list">
      @for (attempt of progress.attempts(); track attempt.id) {
        <a class="content-card" [routerLink]="['/content', attempt.quizId]">
          <div>
            <h3>{{ title(attempt.quizId, attempt.title) }}</h3>
            <p class="muted">{{ attempt.completedAt | date: 'medium' }} · {{ attempt.elapsedSeconds }}s</p>
            <span>{{ attempt.correct }}/{{ attempt.total }} {{ i.t('correct') }}</span>
          </div>
          <strong class="attempt-score">{{ attempt.scorePercentage | number: '1.0-0' }}%</strong>
        </a>
      } @empty {
        <div class="panel">
          <p>{{ i.t('noProgress') }}</p>
        </div>
      }
    </div>
  `,
})
export class ProgressOverviewComponent {
  readonly i = inject(I18nService);
  readonly progress = inject(ProgressService);
  readonly experience = inject(LearningExperienceService);
  private readonly content = inject(ContentService);
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
      { label: this.i.t('mistakes'), value: summary.wrongAnswers },
    ];
  });

  constructor() {
    void this.experience.loadOverview().catch(() => undefined);
  }

  title(id: string, fallback?: string): string {
    const info = this.content.getContentDisplayInfo(id, this.i.preferences.language());
    return info.unavailable ? (fallback ?? this.i.t('contentUnavailable')) : info.title;
  }
}
