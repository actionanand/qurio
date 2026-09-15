import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { LearningExperienceService } from '../core/learning-experience.service';
import type { Question, Quiz } from '../core/models';
import { IconComponent } from '../shared/icon.component';

interface MistakeGroup {
  quizId: string;
  questions: { id: string; wrongCount: number; lastWrongAt: string | null }[];
  totalWrong: number;
  lastWrongAt: string | null;
}

@Component({
  selector: 'app-progress-mistakes',
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    <div class="content-list">
      @for (group of groups(); track group.quizId) {
        <article class="progress-card">
          <button
            class="card-toggle"
            type="button"
            [attr.aria-expanded]="expanded() === group.quizId"
            (click)="toggle(group.quizId)">
            <div>
              <h3>{{ title(group.quizId) }}</h3>
              <p class="muted">
                {{ group.questions.length }} {{ i.t('questionsMissed') }} · {{ i.t('totalWrong') }}:
                {{ group.totalWrong }}
              </p>
              @if (group.lastWrongAt) {
                <small>{{ i.t('lastMistake') }}: {{ group.lastWrongAt | date: 'mediumDate' }}</small>
              }
            </div>
            <app-icon [name]="expanded() === group.quizId ? 'chevronUp' : 'chevron'" />
          </button>
          @if (expanded() === group.quizId) {
            <div class="mistake-details">
              @if (loading() === group.quizId) {
                <p role="status">{{ i.t('loading') }}</p>
              }
              @for (entry of group.questions; track entry.id) {
                <div class="mistake-question">
                  <strong>{{ question(group.quizId, entry.id)?.question ?? entry.id }}</strong>
                  @if (question(group.quizId, entry.id); as detail) {
                    <p>{{ detail.explanation }}</p>
                  }
                  <span>{{ i.t('totalWrong') }}: {{ entry.wrongCount }}</span>
                </div>
              }
              <a class="button" [routerLink]="['/content', group.quizId]"
                ><app-icon name="quiz" />{{ i.t('practiceAgain') }}</a
              >
            </div>
          }
        </article>
      } @empty {
        <div class="empty-state">
          <app-icon name="correct" />
          <p>{{ i.t('noMistakes') }}</p>
        </div>
      }
    </div>
  `,
})
export class ProgressMistakesComponent {
  readonly i = inject(I18nService);
  readonly experience = inject(LearningExperienceService);
  private readonly content = inject(ContentService);
  readonly expanded = signal<string | null>(null);
  readonly loading = signal<string | null>(null);
  readonly details = signal<Record<string, Record<string, Question>>>({});
  readonly groups = computed<MistakeGroup[]>(() => {
    const grouped = new Map<string, MistakeGroup>();
    for (const item of this.experience.mistakes()) {
      const group = grouped.get(item.quiz_id) ?? {
        quizId: item.quiz_id,
        questions: [],
        totalWrong: 0,
        lastWrongAt: null,
      };
      group.questions.push({ id: item.question_id, wrongCount: item.wrong_count, lastWrongAt: item.last_wrong_at });
      group.totalWrong += item.wrong_count;
      if (item.last_wrong_at && (!group.lastWrongAt || item.last_wrong_at > group.lastWrongAt))
        group.lastWrongAt = item.last_wrong_at;
      grouped.set(item.quiz_id, group);
    }
    return [...grouped.values()].sort((a, b) => (b.lastWrongAt ?? '').localeCompare(a.lastWrongAt ?? ''));
  });

  constructor() {
    void this.experience.loadMistakes().catch(() => undefined);
  }

  title(id: string): string {
    return this.content.getContentDisplayInfo(id, this.i.preferences.language()).title;
  }

  question(quizId: string, questionId: string): Question | undefined {
    return this.details()[quizId]?.[questionId];
  }

  async toggle(quizId: string): Promise<void> {
    if (this.expanded() === quizId) {
      this.expanded.set(null);
      return;
    }
    this.expanded.set(quizId);
    if (this.details()[quizId]) return;
    this.loading.set(quizId);
    try {
      const result = await this.content.resolve(quizId, this.i.preferences.language());
      if (!('attributes' in result.content)) {
        const quiz = result.content as Quiz;
        this.details.update(value => ({
          ...value,
          [quizId]: Object.fromEntries(quiz.questions.map(question => [question.id, question])),
        }));
      }
    } finally {
      this.loading.set(null);
    }
  }
}
