import { computed, signal } from '@angular/core';
import type { Attempt, Question, Quiz } from './models';
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export class QuizSession {
  readonly questions: Question[];
  readonly index = signal(0);
  readonly selected = signal<string | null>(null);
  readonly answers = signal<Record<string, string>>({});
  readonly hintVisible = signal(false);
  readonly remaining = signal(0);
  readonly started = signal(false);
  readonly result = signal<Attempt | null>(null);
  readonly question = computed(() => this.questions[this.index()]);
  readonly locked = computed(() => this.answers()[this.question().id] !== undefined);
  private timer?: ReturnType<typeof setInterval>;
  private startedAt = 0;
  constructor(
    readonly quiz: Quiz,
    private readonly save: (attempt: Attempt) => void,
  ) {
    this.questions = (quiz.shuffleQuestions ? shuffle(quiz.questions) : [...quiz.questions]).map(q => ({
      ...q,
      options: quiz.shuffleOptions ? shuffle(q.options) : [...q.options],
    }));
    this.remaining.set(quiz.timeLimitSeconds);
  }
  start() {
    if (this.started()) return;
    this.startedAt = Date.now();
    this.started.set(true);
    this.timer = setInterval(() => this.tick(), 250);
  }
  private tick() {
    this.remaining.set(Math.max(0, Math.ceil(this.quiz.timeLimitSeconds - (Date.now() - this.startedAt) / 1000)));
    if (!this.remaining()) this.finish(true);
  }
  select(id: string) {
    if (this.started() && !this.locked() && !this.result() && this.question().options.some(o => o.id === id))
      this.selected.set(id);
  }
  check() {
    if (!this.started() || this.result()) return;
    this.tick();
    const selected = this.selected();
    if (!this.result() && !this.locked() && selected)
      this.answers.update(answers => ({ ...answers, [this.question().id]: selected }));
  }
  next() {
    if (!this.locked() || this.result()) return;
    this.tick();
    if (this.result()) return;
    if (this.index() === this.questions.length - 1) {
      this.finish(false);
      return;
    }
    this.index.update(i => i + 1);
    this.selected.set(null);
    this.hintVisible.set(false);
  }
  finish(autoSubmitted: boolean) {
    if (!this.started() || this.result()) return;
    this.destroy();
    const total = this.questions.length;
    const correct = this.questions.filter(q => this.answers()[q.id] === q.correctOption).length;
    const answered = Object.keys(this.answers()).length;
    const scorePercentage = (correct / total) * 100;
    const result: Attempt = {
      id: crypto.randomUUID(),
      quizId: this.quiz.id,
      total,
      correct,
      wrong: answered - correct,
      unanswered: total - answered,
      scorePercentage,
      passed: scorePercentage >= this.quiz.passingPercentage,
      elapsedSeconds: Math.min(this.quiz.timeLimitSeconds, Math.round((Date.now() - this.startedAt) / 1000)),
      completedAt: new Date().toISOString(),
      languageUsed: this.quiz.language,
      autoSubmitted,
    };
    this.result.set(result);
    this.save(result);
  }
  destroy() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
}
