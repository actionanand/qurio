import { Service, inject, signal } from '@angular/core';
import type { LeaderboardQuery, LeaderboardRow, LearningSummary } from './models';
import { LearnerStateRepository, type WrongQuestionStat } from '../services/learner-state.repository';

const emptySummary: LearningSummary = {
  lessonsStarted: 0,
  lessonsCompleted: 0,
  quizAttempts: 0,
  uniqueQuizzesAttempted: 0,
  questionsAnswered: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  unansweredAnswers: 0,
  averageScore: 0,
  bestScore: 0,
};

@Service()
export class LearningExperienceService {
  private readonly repository = inject(LearnerStateRepository);
  readonly summary = signal(emptySummary);
  readonly mistakes = signal<WrongQuestionStat[]>([]);
  readonly leaderboard = signal<LeaderboardRow[]>([]);
  readonly myRank = signal<LeaderboardRow | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  async loadOverview(): Promise<void> {
    this.summary.set(await this.repository.loadLearningSummary());
  }

  async loadMistakes(): Promise<void> {
    this.mistakes.set(await this.repository.wrongQuestionStats());
  }

  async loadLeaderboard(query: LeaderboardQuery): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const [rows, own] = await Promise.all([
        this.repository.loadLeaderboard(query),
        this.repository.loadLeaderboard(query, true),
      ]);
      this.leaderboard.set(rows);
      this.myRank.set(own[0] ?? rows.find(row => row.isCurrentUser) ?? null);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
