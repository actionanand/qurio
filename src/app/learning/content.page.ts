import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { ProgressService } from '../core/progress.service';
import type { Quiz, StudyDocument } from '../core/models';
import { MarkdownViewerComponent } from './markdown-viewer.component';
import { QuizPlayerComponent } from './quiz-player.component';
@Component({
  selector: 'app-content',
  imports: [RouterLink, MarkdownViewerComponent, QuizPlayerComponent, IconComponent],
  template: ` <a class="back-link" routerLink="/home"><app-icon name="back" />{{ i.t('back') }}</a>
    @if (loading()) {
      <p role="status">{{ i.t('loading') }}</p>
    } @else if (error()) {
      <div class="panel" role="alert">
        <p>{{ i.t('error') }}</p>
        <button (click)="retry.update(increment)">{{ i.t('retry') }}</button>
      </div>
    } @else {
      @if (fallback()) {
        <p class="notice" role="status">{{ i.t('fallback') }}</p>
      }
      @if (document(); as doc) {
        <article class="panel reader" [attr.lang]="doc.attributes.language">
          <span class="eyebrow">{{ i.t(doc.attributes.type) }}</span>
          <h1>{{ doc.attributes.title }}</h1>
          <app-markdown-viewer [body]="doc.body" />
        </article>
        @if (doc.attributes.type === 'note') {
          <div class="reader-actions">
            <button
              (click)="progress.complete(doc.attributes.id)"
              [disabled]="progress.completed().includes(doc.attributes.id)">
              {{ i.t(progress.completed().includes(doc.attributes.id) ? 'completed' : 'complete') }}
            </button>
            @for (quizId of doc.attributes.quizIds ?? []; track quizId) {
              <a class="button secondary" [routerLink]="['/content', quizId]"
                >{{ i.t('quiz') }}<app-icon name="forward"
              /></a>
            }
          </div>
        }
      }
      @if (quiz(); as currentQuiz) {
        <app-quiz-player [quiz]="currentQuiz" />
      }
    }`,
})
export class ContentPage {
  readonly id = input.required<string>();
  readonly i = inject(I18nService);
  readonly progress = inject(ProgressService);
  private readonly content = inject(ContentService);
  readonly document = signal<StudyDocument | null>(null);
  readonly quiz = signal<Quiz | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly fallback = signal(false);
  readonly retry = signal(0);
  readonly increment = (value: number) => value + 1;
  constructor() {
    effect(onCleanup => {
      const id = this.id();
      const language = this.i.preferences.language();
      this.retry();
      let cancelled = false;
      this.loading.set(true);
      this.error.set(false);
      this.quiz.set(null);
      this.document.set(null);
      void this.content
        .resolve(id, language)
        .then(result => {
          if (cancelled) return;
          this.fallback.set(result.fallbackUsed);
          if ('attributes' in result.content) this.document.set(result.content);
          else this.quiz.set(result.content);
        })
        .catch(() => {
          if (!cancelled) this.error.set(true);
        })
        .finally(() => {
          if (!cancelled) this.loading.set(false);
        });
      onCleanup(() => {
        cancelled = true;
      });
    });
  }
}
