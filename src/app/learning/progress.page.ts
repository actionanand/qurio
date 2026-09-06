import { Component, effect, inject, signal } from '@angular/core';
import { ContentService } from '../core/content.service';
import { IconComponent } from '../shared/icon.component';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n.service';
import { ProgressService } from '../core/progress.service';
@Component({
  selector: 'app-progress',
  imports: [DatePipe, DecimalPipe, RouterLink, IconComponent],
  template: `
    <span class="eyebrow">QURIO · {{ i.t('progress') }}</span>
    <h1>{{ i.t('progress') }}</h1>
    <p class="muted">{{ i.t('local') }}</p>
    <div class="stats panel">
      <div>
        <strong>{{ progress.completed().length }}</strong
        >{{ i.t('notesDone') }}
      </div>
      <div>
        <strong>{{ progress.attempts().length }}</strong
        >{{ i.t('attempts') }}
      </div>
      <div>
        <strong>{{ progress.average() }}%</strong>{{ i.t('average') }}
      </div>
    </div>
    <h2>{{ i.t('recent') }}</h2>
    <div class="content-list">
      @for (attempt of progress.attempts(); track attempt.id) {
        <a class="content-card" [routerLink]="['/content', attempt.quizId]"
          ><div>
            <h3>{{ titles()[attempt.quizId] || attempt.title || i.t('quiz') }}</h3>
            <p class="muted">
              {{ attempt.completedAt | date: 'medium' }} · {{ attempt.languageUsed }} · {{ attempt.elapsedSeconds }}s
            </p>
            <span>{{ attempt.correct }}/{{ attempt.total }} {{ i.t('correct') }}</span>
          </div>
          <strong class="attempt-score">{{ attempt.scorePercentage | number: '1.0-0' }}%</strong></a
        >
      } @empty {
        <div class="panel">
          <p>{{ i.t('noProgress') }}</p>
          <a class="button" routerLink="/home">{{ i.t('learn') }}<app-icon name="forward" /></a>
        </div>
      }
    </div>
  `,
})
export class ProgressPage {
  readonly i = inject(I18nService);
  readonly progress = inject(ProgressService);
  private readonly content = inject(ContentService);
  readonly titles = signal<Record<string, string>>({});
  constructor() {
    effect(onCleanup => {
      const language = this.i.preferences.language();
      const ids = [...new Set(this.progress.attempts().map(attempt => attempt.quizId))];
      let cancelled = false;
      this.titles.set({});
      for (const id of ids) {
        void this.content
          .resolve(id, language)
          .then(result => {
            if (!cancelled && !('attributes' in result.content)) {
              const title = result.content.title;
              this.titles.update(titles => ({ ...titles, [id]: title }));
            }
          })
          .catch(() => undefined);
      }
      onCleanup(() => {
        cancelled = true;
      });
    });
  }
}
