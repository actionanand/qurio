import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { Attempt } from '../core/models';
import { ContentService } from '../core/content.service';
import { AuthService } from './auth.service';
import { LearnerStateRepository, mapLeaderboardRows, mapLearningSummary } from './learner-state.repository';
import { SupabaseService } from './supabase.service';

describe('mapLearningSummary', () => {
  it('maps numeric Supabase results to the client model', () => {
    expect(
      mapLearningSummary({
        lessons_started: '4',
        lessons_completed: 3,
        quiz_attempts: '8',
        unique_quizzes_attempted: 5,
        questions_answered: 40,
        correct_answers: 31,
        wrong_answers: 7,
        unanswered_answers: 2,
        average_score: '77.5',
        best_score: 100,
      }),
    ).toEqual({
      lessonsStarted: 4,
      lessonsCompleted: 3,
      quizAttempts: 8,
      uniqueQuizzesAttempted: 5,
      questionsAnswered: 40,
      correctAnswers: 31,
      wrongAnswers: 7,
      unansweredAnswers: 2,
      averageScore: 77.5,
      bestScore: 100,
    });
  });
  it('maps the current-user marker and returns no private fields', () => {
    const rows = mapLeaderboardRows([
      {
        rank: 4,
        display_name: 'Learner',
        points: 180,
        average_score: 90,
        quizzes_completed: 2,
        correct_answers: 18,
        is_current_user: true,
        email: 'private@example.com',
      },
    ]);
    expect(rows[0]).toEqual({
      rank: 4,
      displayName: 'Learner',
      points: 180,
      averageScore: 90,
      quizzesCompleted: 2,
      correctAnswers: 18,
      isCurrentUser: true,
    });
    expect(rows[0]).not.toHaveProperty('email');
  });
});

describe('LearnerStateRepository writes and mistake details', () => {
  const attempt: Attempt = {
    id: '00000000-0000-0000-0000-000000000001',
    quizId: 'quiz-1',
    total: 1,
    correct: 0,
    wrong: 1,
    unanswered: 0,
    scorePercentage: 0,
    passed: false,
    elapsedSeconds: 20,
    completedAt: '2026-09-15T10:00:00.000Z',
    languageUsed: 'en',
    autoSubmitted: false,
    startedAt: '2026-09-15T09:59:40.000Z',
    passingPercentage: 60,
    answers: [
      {
        questionId: 'question-1',
        selectedOptionId: 'b',
        correctOptionId: 'a',
        isCorrect: false,
        hintUsed: false,
        timeSpentSeconds: 20,
        answeredAt: '2026-09-15T10:00:00.000Z',
      },
    ],
  };

  function createRepository(client: object): LearnerStateRepository {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        LearnerStateRepository,
        { provide: AuthService, useValue: { approved: () => true, user: () => ({ id: 'user-1' }) } },
        { provide: SupabaseService, useValue: { client } },
        {
          provide: ContentService,
          useValue: {
            getItemById: () => ({
              curriculum: 'cbse',
              grade: 5,
              subject: 'mathematics',
              chapter: 'fractions',
              topic: 'equivalent-fractions',
            }),
          },
        },
      ],
    });
    return TestBed.inject(LearnerStateRepository);
  }

  it('throws on an attempt RPC error and sends manifest category metadata', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('RPC failed') });
    const repository = createRepository({ rpc });
    await expect(repository.submitAttempt(attempt)).rejects.toThrow('RPC failed');
    expect(rpc).toHaveBeenCalledWith(
      'submit_quiz_attempt',
      expect.objectContaining({
        payload: expect.objectContaining({
          curriculum_id: 'cbse',
          grade: 5,
          subject_id: 'mathematics',
          chapter_id: 'fractions',
          topic_id: 'equivalent-fractions',
        }),
      }),
    );
  });

  it('scopes latest wrong-answer rows to the supplied quiz and questions', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          quiz_id: 'quiz-1',
          question_id: 'question-1',
          selected_option_id: 'b',
          correct_option_id: 'a',
          answered_at: '2026-09-15T10:00:00.000Z',
        },
        {
          quiz_id: 'quiz-1',
          question_id: 'question-1',
          selected_option_id: 'c',
          correct_option_id: 'a',
          answered_at: '2026-09-14T10:00:00.000Z',
        },
      ],
      error: null,
    });
    const inFilter = vi.fn().mockReturnValue({ order });
    const secondEq = vi.fn().mockReturnValue({ in: inFilter });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const select = vi.fn().mockReturnValue({ eq: firstEq });
    const from = vi.fn().mockReturnValue({ select });
    const repository = createRepository({ from });
    const rows = await repository.latestWrongAnswers('quiz-1', ['question-1', 'question-2']);
    expect(firstEq).toHaveBeenCalledWith('quiz_id', 'quiz-1');
    expect(secondEq).toHaveBeenCalledWith('is_correct', false);
    expect(inFilter).toHaveBeenCalledWith('question_id', ['question-1', 'question-2']);
    expect(rows).toEqual([
      {
        quizId: 'quiz-1',
        questionId: 'question-1',
        selectedOptionId: 'b',
        correctOptionId: 'a',
        answeredAt: '2026-09-15T10:00:00.000Z',
      },
    ]);
  });
});
