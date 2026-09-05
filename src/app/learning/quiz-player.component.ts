import { Component, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonButton } from '@ionic/angular';
import { IconComponent } from '../shared/icon.component';
import type { Quiz } from '../core/models';
import { QuizSession } from '../core/quiz-session';
import { I18nService } from '../core/i18n.service';
import { ProgressService } from '../core/progress.service';
@Component({
  selector: 'app-quiz-player',
  imports: [DecimalPipe, IonButton, IconComponent],
  templateUrl: './quiz-player.component.html',
})
export class QuizPlayerComponent {
  readonly quiz = input.required<Quiz>();
  readonly i = inject(I18nService);
  private readonly progress = inject(ProgressService);
  readonly session = signal<QuizSession | null>(null);
  constructor() {
    effect(onCleanup => {
      const session = new QuizSession(this.quiz(), attempt => this.progress.record(attempt));
      this.session.set(session);
      onCleanup(() => session.destroy());
    });
  }
  format(seconds: number) {
    return (
      Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0') +
      ':' +
      (seconds % 60).toString().padStart(2, '0')
    );
  }
  start(session: QuizSession) {
    session.start();
    setTimeout(() => document.getElementById('question-heading')?.focus());
  }
  next(session: QuizSession) {
    session.next();
    setTimeout(() => document.getElementById(session.result() ? 'results-heading' : 'question-heading')?.focus());
  }
}
