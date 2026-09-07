import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { ProgressService } from '../core/progress.service';
import type { ManifestItem, Quiz, StudyDocument } from '../core/models';
import { MarkdownViewerComponent } from './markdown-viewer.component';
import { QuizPlayerComponent } from './quiz-player.component';

interface RelatedQuiz {
  item: ManifestItem;
  title: string;
  label: string;
}

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
          <span class="eyebrow"><app-icon [name]="doc.attributes.type" />{{ i.t(doc.attributes.type) }}</span>
          <h1>{{ doc.attributes.title }}</h1>
          <app-markdown-viewer [body]="doc.body" />
        </article>
        @if (doc.attributes.type === 'note') {
          <div class="reader-actions">
            <button
              (click)="progress.complete(doc.attributes.id)"
              [disabled]="progress.completed().includes(doc.attributes.id)">
              <app-icon name="correct" />{{
                i.t(progress.completed().includes(doc.attributes.id) ? 'completed' : 'complete')
              }}
            </button>
          </div>
          @if (relatedQuizzes().length) {
            <section class="panel practice-list">
              <span class="eyebrow"><app-icon name="quiz" />{{ i.t('practiceSets') }}</span>
              <h2>{{ i.t('practiceSets') }}</h2>
              <div class="content-list compact-list">
                @for (quiz of relatedQuizzes(); track quiz.item.id) {
                  <a class="content-card" [routerLink]="['/content', quiz.item.id]">
                    <span class="type-icon"><app-icon name="quiz" /></span>
                    <div class="card-copy">
                      <span class="eyebrow">{{ quiz.label }}</span>
                      <h3>{{ quiz.title }}</h3>
                    </div>
                    <app-icon class="arrow" name="chevron" />
                  </a>
                }
              </div>
            </section>
          }
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
  readonly relatedQuizzes = signal<RelatedQuiz[]>([]);
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
      this.relatedQuizzes.set([]);
      void this.content
        .resolve(id, language)
        .then(async result => {
          if (cancelled) return;
          this.fallback.set(result.fallbackUsed);
          if ('attributes' in result.content) {
            this.document.set(result.content);
            if (result.content.attributes.type === 'note')
              await this.loadRelated(result.content.attributes.quizIds ?? [], language, cancelled);
          } else this.quiz.set(result.content);
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

  private async loadRelated(
    ids: string[],
    language: ReturnType<I18nService['preferences']['language']>,
    cancelled: boolean,
  ) {
    const items = ids
      .map(id => this.content.getItemById(id))
      .filter((item): item is ManifestItem => !!item && item.type === 'quiz')
      .sort((a, b) => (a.setNumber ?? 1) - (b.setNumber ?? 1) || a.id.localeCompare(b.id));
    const resolved = await Promise.all(
      items.map(async item => {
        try {
          const result = await this.content.resolve(item.id, language);
          if ('attributes' in result.content) return null;
          return {
            item,
            title: result.content.title,
            label:
              result.content.setLabel ??
              `${this.i.t('practiceSets')} ${item.setNumber ?? result.content.setNumber ?? 1}`,
          };
        } catch {
          return null;
        }
      }),
    );
    if (!cancelled) this.relatedQuizzes.set(resolved.filter((item): item is RelatedQuiz => !!item));
  }
}
