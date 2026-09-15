import { describe, expect, it } from 'vitest';
import { mapLeaderboardRows, mapLearningSummary } from './learner-state.repository';

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
