import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { LearningExperienceService } from '../core/learning-experience.service';
import type { Question, Quiz } from '../core/models';
import type { WrongAnswerDetail } from '../services/learner-state.repository';
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
    @if (experience.mistakesLoading() && !experience.mistakesLoaded()) {
      <p class="progress-message" role="status">{{ i.t('loading') }}</p>
    } @else if (experience.mistakesError()) {
      <p class="progress-message error" role="alert">{{ i.t('progressUnavailable') }}</p>
    } @else {
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
                  {{ i.count(group.questions.length, 'questionMissed', 'questionsMissed') }} ·
                  {{ i.count(group.totalWrong, 'wrongAnswer', 'wrongAnswers') }}
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
                } @else if (detailErrors()[group.quizId]) {
                  <p class="error" role="alert">{{ i.t('progressUnavailable') }}</p>
                } @else {
                  @for (entry of group.questions; track entry.id) {
                    @if (question(group.quizId, entry.id); as questionDetail) {
                      <article class="mistake-question">
                        <dl>
                          <div>
                            <dt>{{ i.t('questionLabel') }}</dt>
                            <dd>
                              <strong>{{ questionDetail.question }}</strong>
                            </dd>
                          </div>
                          @if (answer(group.quizId, entry.id); as answerDetail) {
                            <div>
                              <dt>{{ i.t('yourAnswer') }}</dt>
                              <dd class="wrong-answer">
                                {{ optionText(questionDetail, answerDetail.selectedOptionId) }}
                              </dd>
                            </div>
                          }
                          <div>
                            <dt>{{ i.t('correctAnswer') }}</dt>
                            <dd class="correct-answer">
                              {{ optionText(questionDetail, questionDetail.correctOption) }}
                            </dd>
                          </div>
                          <div>
                            <dt>{{ i.t('explanation') }}</dt>
                            <dd>{{ questionDetail.explanation }}</dd>
                          </div>
                        </dl>
                        <div class="mistake-facts">
                          <span>{{ i.t('missed') }}: {{ i.count(entry.wrongCount, 'timeOnce', 'times') }}</span>
                          @if (entry.lastWrongAt) {
                            <span>{{ i.t('lastMissed') }}: {{ entry.lastWrongAt | date: 'mediumDate' }}</span>
                          }
                        </div>
                      </article>
                    }
                  }
                }
                <a class="button" [routerLink]="['/content', group.quizId]">
                  <app-icon name="quiz" />{{ i.t('practiceAgain') }}
                </a>
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
    }
  `,
})
export class ProgressMistakesComponent {
  readonly i = inject(I18nService);
  readonly experience = inject(LearningExperienceService);
  private readonly content = inject(ContentService);
  readonly expanded = signal<string | null>(null);
  readonly loading = signal<string | null>(null);
  readonly details = signal<Record<string, Record<string, Question>>>({});
  readonly answerDetails = signal<Record<string, Record<string, WrongAnswerDetail>>>({});
  readonly detailErrors = signal<Record<string, boolean>>({});
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

  answer(quizId: string, questionId: string): WrongAnswerDetail | undefined {
    return this.answerDetails()[quizId]?.[questionId];
  }

  optionText(question: Question, optionId: string | null): string {
    if (optionId === null) return this.i.t('notAnswered');
    return question.options.find(option => option.id === optionId)?.text ?? optionId;
  }

  async toggle(quizId: string): Promise<void> {
    if (this.expanded() === quizId) {
      this.expanded.set(null);
      return;
    }
    this.expanded.set(quizId);
    if (this.details()[quizId]) return;
    this.loading.set(quizId);
    this.detailErrors.update(value => ({ ...value, [quizId]: false }));
    try {
      const group = this.groups().find(value => value.quizId === quizId);
      const [contentResult, answerResult] = await Promise.allSettled([
        this.content.resolve(quizId, this.i.preferences.language()),
        this.experience.loadWrongAnswerDetails(quizId, group?.questions.map(question => question.id) ?? []),
      ]);
      if (contentResult.status === 'rejected') throw contentResult.reason;
      const result = contentResult.value;
      const answerRows = answerResult.status === 'fulfilled' ? answerResult.value : [];
      if (!('attributes' in result.content)) {
        const quiz = result.content as Quiz;
        this.details.update(value => ({
          ...value,
          [quizId]: Object.fromEntries(quiz.questions.map(question => [question.id, question])),
        }));
        this.answerDetails.update(value => ({
          ...value,
          [quizId]: Object.fromEntries(answerRows.map(answer => [answer.questionId, answer])),
        }));
      }
    } catch {
      this.detailErrors.update(value => ({ ...value, [quizId]: true }));
    } finally {
      this.loading.set(null);
    }
  }
}
