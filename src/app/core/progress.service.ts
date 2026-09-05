import { Service, computed, signal } from '@angular/core';
import type { Attempt } from './models';
import { readLocal } from './preferences.service';
@Service()
export class ProgressService {
  readonly completed = signal<string[]>([]);
  readonly attempts = signal<Attempt[]>([]);
  readonly storageUnavailable = signal(false);
  readonly average = computed(() =>
    this.attempts().length
      ? Math.round(this.attempts().reduce((sum, attempt) => sum + attempt.scorePercentage, 0) / this.attempts().length)
      : 0,
  );
  constructor() {
    const saved = readLocal('qurio.progress.v1');
    if (saved && typeof saved === 'object') {
      if ('completed' in saved && Array.isArray(saved.completed))
        this.completed.set(saved.completed.filter((id): id is string => typeof id === 'string'));
      if ('attempts' in saved && Array.isArray(saved.attempts))
        this.attempts.set(
          saved.attempts.filter(
            (a): a is Attempt =>
              !!a &&
              typeof a === 'object' &&
              typeof a.id === 'string' &&
              typeof a.quizId === 'string' &&
              Number.isFinite(a.scorePercentage) &&
              typeof a.completedAt === 'string',
          ),
        );
    }
  }
  complete(id: string) {
    this.completed.update(ids => (ids.includes(id) ? ids : [...ids, id]));
    this.save();
  }
  record(attempt: Attempt) {
    this.attempts.update(attempts => (attempts.some(a => a.id === attempt.id) ? attempts : [attempt, ...attempts]));
    this.save();
  }
  private save() {
    try {
      localStorage.setItem(
        'qurio.progress.v1',
        JSON.stringify({ completed: this.completed(), attempts: this.attempts() }),
      );
    } catch {
      this.storageUnavailable.set(true);
    }
  }
}
