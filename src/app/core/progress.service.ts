import { Service, computed, effect, inject, signal } from '@angular/core';
import type { Attempt } from './models';
import { readLocal } from './preferences.service';
import { LearnerStateRepository } from '../services/learner-state.repository';
import { PreferencesService } from './preferences.service';
import { SnackbarService } from './snackbar.service';
import { I18nService } from './i18n.service';

export type AttemptSyncState = 'synced' | 'pending' | 'failed' | 'legacy-device-only';
type UserSyncStates = Record<string, Record<string, AttemptSyncState>>;

@Service()
export class ProgressService {
  private readonly remote = inject(LearnerStateRepository);
  private readonly preferences = inject(PreferencesService);
  private readonly snackbar = inject(SnackbarService);
  private readonly i = inject(I18nService);
  private readonly localCompleted = signal<string[]>([]);
  private readonly localAttempts = signal<Attempt[]>([]);
  private readonly remoteCompleted = signal<string[]>([]);
  private readonly syncStates = signal<UserSyncStates>({});
  private readonly completionOwners = signal<Record<string, string>>({});
  private activeUserId: string | null | undefined;
  private loadGeneration = 0;

  readonly completed = signal<string[]>([]);
  readonly attempts = signal<Attempt[]>([]);
  readonly legacyAttempts = signal<Attempt[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal(false);
  readonly canonicalRevision = signal(0);
  readonly storageUnavailable = signal(false);
  readonly average = computed(() =>
    this.attempts().length
      ? Math.round(this.attempts().reduce((sum, attempt) => sum + attempt.scorePercentage, 0) / this.attempts().length)
      : 0,
  );

  constructor() {
    this.restoreLocalProgress();
    this.restoreSyncStates();
    this.restoreCompletionOwners();
    effect(() => {
      const userId = this.remote.approvedUserId();
      if (userId === this.activeUserId) return;
      this.activeUserId = userId;
      const generation = ++this.loadGeneration;
      if (!userId) {
        this.loading.set(false);
        this.loaded.set(true);
        this.error.set(false);
        this.completed.set(this.localCompleted());
        this.attempts.set(this.sorted(this.localAttempts()));
        this.legacyAttempts.set([]);
        return;
      }
      void this.loadApprovedUser(userId, generation);
    });
  }

  complete(id: string): void {
    this.localCompleted.update(ids => (ids.includes(id) ? ids : [...ids, id]));
    this.saveLocalProgress();
    if (!this.activeUserId) {
      this.completed.set(this.localCompleted());
      return;
    }
    this.completed.update(ids => (ids.includes(id) ? ids : [...ids, id]));
    this.completionOwners.update(owners => ({ ...owners, [id]: this.activeUserId as string }));
    this.saveCompletionOwners();
    void this.syncCompletion(id, this.activeUserId);
  }

  record(attempt: Attempt): void {
    this.localAttempts.update(attempts =>
      attempts.some(current => current.id === attempt.id) ? attempts : [attempt, ...attempts],
    );
    this.saveLocalProgress();
    const userId = this.activeUserId;
    if (!userId) {
      this.attempts.set(this.sorted(this.localAttempts()));
      return;
    }
    if (!isSyncableAttempt(attempt)) {
      this.setSyncState(userId, attempt.id, 'legacy-device-only');
      this.legacyAttempts.update(attempts =>
        this.sorted([attempt, ...attempts.filter(item => item.id !== attempt.id)]),
      );
      return;
    }
    this.setSyncState(userId, attempt.id, 'pending');
    this.attempts.update(attempts => this.sorted([attempt, ...attempts.filter(item => item.id !== attempt.id)]));
    void this.synchronizeAttempt(attempt, userId, false);
  }

  syncState(attemptId: string): AttemptSyncState | undefined {
    return this.activeUserId ? this.syncStates()[this.activeUserId]?.[attemptId] : undefined;
  }

  async retryAttemptSync(attemptId: string): Promise<void> {
    const userId = this.activeUserId;
    const attempt = this.localAttempts().find(item => item.id === attemptId);
    if (!userId || !attempt || !isSyncableAttempt(attempt)) return;
    this.setSyncState(userId, attemptId, 'pending');
    await this.synchronizeAttempt(attempt, userId, true);
  }

  clearDeletedUser(userId: string): void {
    this.syncStates.update(states => {
      const next = { ...states };
      delete next[userId];
      return next;
    });
    this.completionOwners.update(owners =>
      Object.fromEntries(Object.entries(owners).filter(([, owner]) => owner !== userId)),
    );
    this.saveSyncStates();
    this.saveCompletionOwners();
    if (this.activeUserId !== userId) return;
    this.localCompleted.set([]);
    this.localAttempts.set([]);
    this.remoteCompleted.set([]);
    this.completed.set([]);
    this.attempts.set([]);
    this.legacyAttempts.set([]);
    this.saveLocalProgress();
  }

  private async loadApprovedUser(userId: string, generation: number): Promise<void> {
    this.loading.set(true);
    this.loaded.set(false);
    this.error.set(false);
    try {
      const [completed, remoteAttempts] = await Promise.all([
        this.remote.loadCompletedContent(),
        this.remote.loadAttempts(),
      ]);
      if (!this.isCurrent(userId, generation)) return;
      this.remoteCompleted.set(completed);
      this.completed.set(completed);
      this.applyCanonicalAttempts(userId, remoteAttempts);

      const missingCompletions = this.localCompleted().filter(
        id => !completed.includes(id) && (!this.completionOwners()[id] || this.completionOwners()[id] === userId),
      );
      if (missingCompletions.length) {
        this.completionOwners.update(owners => ({
          ...owners,
          ...Object.fromEntries(missingCompletions.map(id => [id, userId])),
        }));
        this.saveCompletionOwners();
      }
      const remoteIds = new Set(remoteAttempts.map(attempt => attempt.id));
      const syncable = this.localAttempts().filter(
        attempt =>
          !remoteIds.has(attempt.id) && isSyncableAttempt(attempt) && !this.claimedByAnotherUser(userId, attempt.id),
      );
      for (const attempt of remoteAttempts) this.setSyncState(userId, attempt.id, 'synced', false);
      for (const attempt of this.localAttempts().filter(attempt => !isSyncableAttempt(attempt))) {
        if (!this.claimedByAnotherUser(userId, attempt.id))
          this.setSyncState(userId, attempt.id, 'legacy-device-only', false);
      }
      this.saveSyncStates();
      this.applyCanonicalAttempts(userId, remoteAttempts);

      await Promise.allSettled(missingCompletions.map(id => this.syncCompletion(id, userId, false)));
      const pendingAttempts = syncable.filter(attempt => this.syncStateFor(userId, attempt.id) !== 'failed');
      for (const attempt of pendingAttempts) this.setSyncState(userId, attempt.id, 'pending');
      this.applyCanonicalAttempts(userId, remoteAttempts);
      await Promise.allSettled(pendingAttempts.map(attempt => this.synchronizeAttempt(attempt, userId, false)));
    } catch {
      if (!this.isCurrent(userId, generation)) return;
      this.error.set(true);
      this.completed.set(this.localCompleted());
      for (const attempt of this.localAttempts()) {
        if (this.claimedByAnotherUser(userId, attempt.id)) continue;
        if (isSyncableAttempt(attempt) && !this.syncStateFor(userId, attempt.id))
          this.setSyncState(userId, attempt.id, 'failed', false);
        if (!isSyncableAttempt(attempt)) this.setSyncState(userId, attempt.id, 'legacy-device-only', false);
      }
      this.saveSyncStates();
      this.attempts.set(
        this.sorted(
          this.localAttempts().filter(
            attempt => isSyncableAttempt(attempt) && !this.claimedByAnotherUser(userId, attempt.id),
          ),
        ),
      );
      this.legacyAttempts.set(
        this.sorted(
          this.localAttempts().filter(
            attempt => !isSyncableAttempt(attempt) && !this.claimedByAnotherUser(userId, attempt.id),
          ),
        ),
      );
    } finally {
      if (this.isCurrent(userId, generation)) {
        this.loading.set(false);
        this.loaded.set(true);
      }
    }
  }

  private async synchronizeAttempt(attempt: Attempt, userId: string, announce: boolean): Promise<void> {
    try {
      await this.remote.submitAttempt(attempt);
      if (this.activeUserId !== userId) return;
      this.setSyncState(userId, attempt.id, 'synced');
      await this.reloadRemoteAttempts(userId, attempt);
      if (announce) this.snackbar.show(this.i.t('syncComplete'));
    } catch {
      if (this.activeUserId !== userId) return;
      try {
        const remoteAttempts = await this.remote.loadAttempts();
        if (remoteAttempts.some(item => item.id === attempt.id)) {
          this.setSyncState(userId, attempt.id, 'synced');
          this.applyCanonicalAttempts(userId, remoteAttempts);
          this.canonicalRevision.update(value => value + 1);
          if (announce) this.snackbar.show(this.i.t('syncComplete'));
          return;
        }
      } catch {
        // Keep the attempt for an explicit retry when connectivity returns.
      }
      this.setSyncState(userId, attempt.id, 'failed');
      this.applyCanonicalAttempts(
        userId,
        this.attempts().filter(item => this.syncStateFor(userId, item.id) === 'synced'),
      );
      if (announce) this.snackbar.show(this.i.t('syncFailed'), 'error');
    }
  }

  private async reloadRemoteAttempts(userId: string, submitted: Attempt): Promise<void> {
    try {
      const attempts = await this.remote.loadAttempts();
      if (this.activeUserId === userId) {
        this.applyCanonicalAttempts(
          userId,
          attempts.some(attempt => attempt.id === submitted.id) ? attempts : [...attempts, submitted],
        );
        this.canonicalRevision.update(value => value + 1);
      }
    } catch {
      if (this.activeUserId === userId)
        this.applyCanonicalAttempts(userId, [...this.attempts().filter(item => item.id !== submitted.id), submitted]);
    }
  }

  private async syncCompletion(id: string, userId: string, announceFailure = true): Promise<void> {
    try {
      await this.remote.saveStudyProgress(id, this.preferences.language(), true);
      if (this.activeUserId !== userId) return;
      const completed = await this.remote.loadCompletedContent();
      if (this.activeUserId !== userId) return;
      this.remoteCompleted.set(completed);
      this.completed.set(completed);
      this.canonicalRevision.update(value => value + 1);
    } catch {
      if (this.activeUserId !== userId) return;
      this.completed.set(this.remoteCompleted());
      if (announceFailure) this.snackbar.show(this.i.t('syncFailed'), 'error');
    }
  }

  private applyCanonicalAttempts(userId: string, remoteAttempts: Attempt[]): void {
    const remoteIds = new Set(remoteAttempts.map(attempt => attempt.id));
    const pending = this.localAttempts().filter(attempt => {
      if (remoteIds.has(attempt.id) || !isSyncableAttempt(attempt)) return false;
      const state = this.syncStateFor(userId, attempt.id);
      return state === 'pending' || state === 'failed';
    });
    this.attempts.set(this.sorted([...remoteAttempts, ...pending]));
    this.legacyAttempts.set(
      this.sorted(
        this.localAttempts().filter(
          attempt => !isSyncableAttempt(attempt) && this.syncStateFor(userId, attempt.id) === 'legacy-device-only',
        ),
      ),
    );
  }

  private syncStateFor(userId: string, attemptId: string): AttemptSyncState | undefined {
    return this.syncStates()[userId]?.[attemptId];
  }

  private claimedByAnotherUser(userId: string, attemptId: string): boolean {
    return Object.entries(this.syncStates()).some(
      ([ownerId, states]) => ownerId !== userId && states[attemptId] !== undefined,
    );
  }

  private setSyncState(userId: string, attemptId: string, state: AttemptSyncState, save = true): void {
    this.syncStates.update(users => ({ ...users, [userId]: { ...users[userId], [attemptId]: state } }));
    if (save) this.saveSyncStates();
  }

  private isCurrent(userId: string, generation: number): boolean {
    return this.activeUserId === userId && this.loadGeneration === generation;
  }

  private sorted(attempts: Attempt[]): Attempt[] {
    return [...new Map(attempts.map(attempt => [attempt.id, attempt])).values()].sort((a, b) =>
      b.completedAt.localeCompare(a.completedAt),
    );
  }

  private restoreLocalProgress(): void {
    const saved = readLocal('qurio.progress.v1');
    if (!saved || typeof saved !== 'object') return;
    if ('completed' in saved && Array.isArray(saved.completed))
      this.localCompleted.set(saved.completed.filter((id): id is string => typeof id === 'string'));
    if ('attempts' in saved && Array.isArray(saved.attempts))
      this.localAttempts.set(saved.attempts.filter(isStoredAttempt));
  }

  private restoreSyncStates(): void {
    const saved = readLocal('qurio.progress.sync.v1');
    if (saved && typeof saved === 'object') this.syncStates.set(saved as UserSyncStates);
  }

  private restoreCompletionOwners(): void {
    const saved = readLocal('qurio.progress.completions.v1');
    if (saved && typeof saved === 'object') this.completionOwners.set(saved as Record<string, string>);
  }

  private saveLocalProgress(): void {
    this.writeLocal('qurio.progress.v1', { completed: this.localCompleted(), attempts: this.localAttempts() });
  }

  private saveSyncStates(): void {
    this.writeLocal('qurio.progress.sync.v1', this.syncStates());
  }

  private saveCompletionOwners(): void {
    this.writeLocal('qurio.progress.completions.v1', this.completionOwners());
  }

  private writeLocal(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      this.storageUnavailable.set(true);
    }
  }
}

export function isSyncableAttempt(attempt: Attempt): boolean {
  return (
    typeof attempt.id === 'string' &&
    !!attempt.id &&
    typeof attempt.quizId === 'string' &&
    !!attempt.quizId &&
    typeof attempt.completedAt === 'string' &&
    !!attempt.completedAt &&
    typeof attempt.startedAt === 'string' &&
    !!attempt.startedAt &&
    ['en', 'ta', 'hi'].includes(attempt.languageUsed) &&
    Number.isInteger(attempt.total) &&
    attempt.total >= 0 &&
    Number.isInteger(attempt.correct) &&
    Number.isInteger(attempt.wrong) &&
    Number.isInteger(attempt.unanswered) &&
    attempt.correct >= 0 &&
    attempt.wrong >= 0 &&
    attempt.unanswered >= 0 &&
    attempt.correct + attempt.wrong + attempt.unanswered === attempt.total &&
    Number.isFinite(attempt.scorePercentage) &&
    Math.abs(attempt.scorePercentage - (attempt.total ? (attempt.correct * 100) / attempt.total : 0)) <= 0.02 &&
    Number.isFinite(attempt.elapsedSeconds) &&
    Number.isFinite(attempt.passingPercentage) &&
    Array.isArray(attempt.answers) &&
    attempt.answers.length === attempt.total &&
    attempt.answers.every(
      answer =>
        typeof answer.questionId === 'string' &&
        !!answer.questionId &&
        (answer.selectedOptionId === null || typeof answer.selectedOptionId === 'string') &&
        typeof answer.correctOptionId === 'string' &&
        !!answer.correctOptionId &&
        typeof answer.isCorrect === 'boolean' &&
        typeof answer.hintUsed === 'boolean' &&
        (answer.timeSpentSeconds === null || Number.isFinite(answer.timeSpentSeconds)) &&
        (answer.answeredAt === null || typeof answer.answeredAt === 'string'),
    )
  );
}

function isStoredAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const attempt = value as Partial<Attempt>;
  return (
    typeof attempt.id === 'string' &&
    typeof attempt.quizId === 'string' &&
    Number.isFinite(attempt.scorePercentage) &&
    typeof attempt.completedAt === 'string'
  );
}
