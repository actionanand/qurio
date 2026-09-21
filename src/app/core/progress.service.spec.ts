import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attempt } from './models';
import { ProgressService } from './progress.service';
import { LearnerStateRepository } from '../services/learner-state.repository';
import { PreferencesService } from './preferences.service';
import { SnackbarService } from './snackbar.service';
import { I18nService } from './i18n.service';

const syncableAttempt = (id: string, completedAt = '2026-09-15T10:00:00.000Z'): Attempt => ({
  id,
  quizId: 'quiz-1',
  total: 1,
  correct: 1,
  wrong: 0,
  unanswered: 0,
  scorePercentage: 100,
  passed: true,
  elapsedSeconds: 30,
  completedAt,
  languageUsed: 'en',
  autoSubmitted: false,
  startedAt: '2026-09-15T09:59:30.000Z',
  passingPercentage: 60,
  answers: [
    {
      questionId: 'question-1',
      selectedOptionId: 'a',
      correctOptionId: 'a',
      isCorrect: true,
      hintUsed: false,
      timeSpentSeconds: 30,
      answeredAt: completedAt,
    },
  ],
});

const legacyAttempt = (id: string): Attempt => {
  const attempt = syncableAttempt(id);
  return { ...attempt, startedAt: undefined, passingPercentage: undefined, answers: undefined };
};

describe('ProgressService', () => {
  const approvedUserId = signal<string | null>(null);
  const repository = {
    approvedUserId,
    loadCompletedContent: vi.fn<() => Promise<string[]>>(),
    loadAttempts: vi.fn<() => Promise<Attempt[]>>(),
    saveStudyProgress: vi.fn<() => Promise<void>>(),
    submitAttempt: vi.fn<() => Promise<void>>(),
  };

  beforeEach(() => {
    localStorage.clear();
    approvedUserId.set(null);
    vi.clearAllMocks();
    repository.loadCompletedContent.mockResolvedValue([]);
    repository.loadAttempts.mockResolvedValue([]);
    repository.saveStudyProgress.mockResolvedValue(undefined);
    repository.submitAttempt.mockResolvedValue(undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProgressService,
        { provide: PreferencesService, useValue: { language: () => 'en' } },
        { provide: LearnerStateRepository, useValue: repository },
        { provide: SnackbarService, useValue: { show: vi.fn() } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });
  });

  it('keeps signed-out progress local and stores completion once by stable ID', () => {
    localStorage.setItem(
      'qurio.progress.v1',
      JSON.stringify({ completed: [], attempts: [legacyAttempt('local-only')] }),
    );
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    progress.complete('math-05-equivalent-fractions');
    progress.complete('math-05-equivalent-fractions');
    expect(progress.completed()).toEqual(['math-05-equivalent-fractions']);
    expect(progress.attempts().map(attempt => attempt.id)).toEqual(['local-only']);
    expect(repository.submitAttempt).not.toHaveBeenCalled();
  });

  it('uses remote attempts as canonical and deduplicates an identical local ID', async () => {
    const remote = syncableAttempt('shared');
    localStorage.setItem(
      'qurio.progress.v1',
      JSON.stringify({ completed: [], attempts: [remote, legacyAttempt('legacy')] }),
    );
    repository.loadAttempts.mockResolvedValue([remote]);
    approvedUserId.set('user-1');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(progress.loaded()).toBe(true));
    expect(progress.attempts().map(attempt => attempt.id)).toEqual(['shared']);
    expect(progress.legacyAttempts().map(attempt => attempt.id)).toEqual(['legacy']);
    expect(repository.submitAttempt).not.toHaveBeenCalled();
  });

  it('submits a complete local-only attempt once and reloads it from the cloud', async () => {
    const local = syncableAttempt('migrate-me');
    localStorage.setItem('qurio.progress.v1', JSON.stringify({ completed: [], attempts: [local] }));
    repository.loadAttempts.mockResolvedValueOnce([]).mockResolvedValueOnce([local]);
    approvedUserId.set('user-1');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(progress.syncState(local.id)).toBe('synced'));
    expect(repository.submitAttempt).toHaveBeenCalledTimes(1);
    expect(progress.attempts().map(attempt => attempt.id)).toEqual(['migrate-me']);
  });

  it('does not submit or include an incomplete legacy attempt in canonical history', async () => {
    const legacy = legacyAttempt('old-device-row');
    localStorage.setItem('qurio.progress.v1', JSON.stringify({ completed: [], attempts: [legacy] }));
    approvedUserId.set('user-1');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(progress.loaded()).toBe(true));
    expect(repository.submitAttempt).not.toHaveBeenCalled();
    expect(progress.attempts()).toEqual([]);
    expect(progress.legacyAttempts()).toEqual([legacy]);
  });

  it('keeps a failed attempt locally and synchronizes it through retry', async () => {
    const local = syncableAttempt('retry-me');
    localStorage.setItem('qurio.progress.v1', JSON.stringify({ completed: [], attempts: [local] }));
    repository.submitAttempt.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    repository.loadAttempts.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([local]);
    approvedUserId.set('user-1');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(progress.syncState(local.id)).toBe('failed'));
    expect(progress.attempts().map(attempt => attempt.id)).toEqual(['retry-me']);
    await progress.retryAttemptSync(local.id);
    expect(progress.syncState(local.id)).toBe('synced');
    expect(repository.submitAttempt).toHaveBeenCalledTimes(2);
    expect(progress.attempts().map(attempt => attempt.id)).toEqual(['retry-me']);
  });

  it('shows a newly recorded approved-user attempt immediately as pending', async () => {
    let finishSubmit: (() => void) | undefined;
    const attempt = syncableAttempt('new-attempt');
    repository.loadAttempts.mockResolvedValueOnce([]).mockResolvedValue([attempt]);
    repository.submitAttempt.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finishSubmit = resolve;
        }),
    );
    approvedUserId.set('user-1');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(progress.loaded()).toBe(true));
    progress.record(attempt);
    expect(progress.syncState(attempt.id)).toBe('pending');
    expect(progress.attempts().map(item => item.id)).toContain(attempt.id);
    expect(JSON.parse(localStorage.getItem('qurio.progress.v1') ?? '{}').attempts).toHaveLength(1);
    finishSubmit?.();
    await vi.waitFor(() => expect(progress.syncState(attempt.id)).toBe('synced'));
  });

  it('synchronizes missing local completion IDs and then uses the remote set', async () => {
    localStorage.setItem('qurio.progress.v1', JSON.stringify({ completed: ['local-lesson'], attempts: [] }));
    repository.loadCompletedContent
      .mockResolvedValueOnce(['cloud-lesson'])
      .mockResolvedValueOnce(['cloud-lesson', 'local-lesson']);
    approvedUserId.set('user-1');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(progress.completed()).toContain('local-lesson'));
    expect(repository.saveStudyProgress).toHaveBeenCalledWith('local-lesson', 'en', true);
    expect(progress.completed()).toEqual(['cloud-lesson', 'local-lesson']);
  });

  it('does not keep a failed lesson save in the approved user canonical set', async () => {
    repository.loadCompletedContent.mockResolvedValue(['cloud-lesson']);
    repository.saveStudyProgress.mockRejectedValueOnce(new Error('offline'));
    approvedUserId.set('user-1');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(progress.loaded()).toBe(true));
    progress.complete('failed-lesson');
    await vi.waitFor(() => expect(progress.completed()).toEqual(['cloud-lesson']));
    expect(JSON.parse(localStorage.getItem('qurio.progress.v1') ?? '{}').completed).toContain('failed-lesson');
  });

  it('recovers from corrupt device data', () => {
    localStorage.setItem('qurio.progress.v1', '{broken');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    expect(progress.completed()).toEqual([]);
  });

  it('removes deleted user state and preserves User B data adopted by User B', async () => {
    const userAAttempt = syncableAttempt('user-a-attempt');
    const userBAttempt = syncableAttempt('user-b-attempt');
    const guestAttempt = legacyAttempt('guest-attempt');
    localStorage.setItem(
      'qurio.progress.v1',
      JSON.stringify({
        completed: ['user-a-completion', 'user-b-completion', 'guest-completion'],
        attempts: [userAAttempt, userBAttempt, guestAttempt],
      }),
    );
    localStorage.setItem(
      'qurio.progress.sync.v1',
      JSON.stringify({
        'user-a': { 'user-a-attempt': 'synced' },
        'user-b': { 'user-b-attempt': 'synced' },
      }),
    );
    localStorage.setItem(
      'qurio.progress.completions.v1',
      JSON.stringify({ 'user-a-completion': 'user-a', 'user-b-completion': 'user-b' }),
    );
    repository.loadAttempts.mockResolvedValue([userBAttempt]);
    approvedUserId.set('user-b');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(progress.loaded()).toBe(true));

    progress.clearDeletedUser('user-a');
    progress.clearDeletedUser('user-a');

    const stored = JSON.parse(localStorage.getItem('qurio.progress.v1') ?? '{}');
    expect(stored.attempts.map((attempt: Attempt) => attempt.id)).toEqual(['user-b-attempt', 'guest-attempt']);
    expect(stored.completed).toEqual(['user-b-completion', 'guest-completion']);
    expect(JSON.parse(localStorage.getItem('qurio.progress.sync.v1') ?? '{}')).toEqual({
      'user-b': { 'user-b-attempt': 'synced', 'guest-attempt': 'legacy-device-only' },
    });
    expect(JSON.parse(localStorage.getItem('qurio.progress.completions.v1') ?? '{}')).toEqual({
      'user-b-completion': 'user-b',
      'guest-completion': 'user-b',
    });
    expect(progress.attempts().map(attempt => attempt.id)).toEqual(['user-b-attempt']);
  });

  it('removes guest data that was adopted by the active deleted account', async () => {
    const userAAttempt = syncableAttempt('user-a-attempt');
    const guestAttempt = legacyAttempt('guest-attempt');
    localStorage.setItem(
      'qurio.progress.v1',
      JSON.stringify({ completed: ['user-a-completion', 'guest-completion'], attempts: [userAAttempt, guestAttempt] }),
    );
    localStorage.setItem('qurio.progress.sync.v1', JSON.stringify({ 'user-a': { 'user-a-attempt': 'synced' } }));
    localStorage.setItem('qurio.progress.completions.v1', JSON.stringify({ 'user-a-completion': 'user-a' }));
    repository.loadAttempts.mockResolvedValue([userAAttempt]);
    approvedUserId.set('user-a');
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(progress.loaded()).toBe(true));

    progress.clearDeletedUser('user-a');

    expect(progress.completed()).toEqual([]);
    expect(progress.attempts()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('qurio.progress.v1') ?? '{}')).toEqual({ completed: [], attempts: [] });
  });

  it('preserves truly unowned guest data when deleting an inactive account', () => {
    const userAAttempt = syncableAttempt('user-a-attempt');
    const guestAttempt = legacyAttempt('guest-attempt');
    localStorage.setItem(
      'qurio.progress.v1',
      JSON.stringify({ completed: ['user-a-completion', 'guest-completion'], attempts: [userAAttempt, guestAttempt] }),
    );
    localStorage.setItem('qurio.progress.sync.v1', JSON.stringify({ 'user-a': { 'user-a-attempt': 'synced' } }));
    localStorage.setItem('qurio.progress.completions.v1', JSON.stringify({ 'user-a-completion': 'user-a' }));
    const progress = TestBed.inject(ProgressService);
    TestBed.flushEffects();

    progress.clearDeletedUser('user-a');

    expect(JSON.parse(localStorage.getItem('qurio.progress.v1') ?? '{}')).toEqual({
      completed: ['guest-completion'],
      attempts: [guestAttempt],
    });
  });
});
