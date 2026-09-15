import { Service, inject } from '@angular/core';
import type { Appearance } from '../core/preferences.service';
import type { Attempt, Bookmark, Language, LeaderboardQuery, LeaderboardRow, LearningSummary } from '../core/models';
import { ContentService } from '../core/content.service';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

export interface CloudSettings {
  preferred_language: Language | null;
  theme: Appearance | null;
  selected_curriculum: string | null;
  selected_grade: number | null;
  selected_exam_plan_id: string | null;
  practice_reminder_enabled: boolean;
  practice_reminder_time: string | null;
  practice_reminder_days: number[] | null;
}

export interface WrongQuestionStat {
  quiz_id: string;
  question_id: string;
  attempts: number;
  wrong_count: number;
  last_wrong_at: string | null;
}

@Service()
export class LearnerStateRepository {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService).client;
  private readonly content = inject(ContentService);
  approvedUserId() {
    return this.auth.approved() ? (this.auth.user()?.id ?? null) : null;
  }

  async loadSettings(): Promise<CloudSettings | null> {
    if (!this.auth.approved()) return null;
    const { data } = await this.supabase
      .from('user_settings')
      .select(
        'preferred_language,theme,selected_curriculum,selected_grade,selected_exam_plan_id,practice_reminder_enabled,practice_reminder_time,practice_reminder_days',
      )
      .maybeSingle();
    return data as CloudSettings | null;
  }

  async saveSettings(settings: CloudSettings) {
    const userId = this.auth.user()?.id;
    if (!userId || !this.auth.approved()) return;
    await this.supabase
      .from('user_settings')
      .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() });
  }

  async loadCompletedContent(): Promise<string[]> {
    if (!this.auth.approved()) return [];
    const { data } = await this.supabase.from('study_progress').select('content_id').eq('state', 'completed');
    return (data ?? []).map(row => String(row.content_id));
  }

  async loadAttempts(): Promise<Attempt[]> {
    if (!this.auth.approved()) return [];
    const { data } = await this.supabase
      .from('quiz_attempts')
      .select(
        'id,quiz_id,series_id,language_used,quiz_version,content_version,started_at,completed_at,auto_submitted,time_taken_seconds,total_questions,correct_count,wrong_count,unanswered_count,score_percent,passing_percentage,passed',
      )
      .order('completed_at', { ascending: false })
      .limit(250);
    return (data ?? []).map(row => ({
      id: String(row.id),
      quizId: String(row.quiz_id),
      total: Number(row.total_questions),
      correct: Number(row.correct_count),
      wrong: Number(row.wrong_count),
      unanswered: Number(row.unanswered_count),
      scorePercentage: Number(row.score_percent),
      passed: Boolean(row.passed),
      elapsedSeconds: Number(row.time_taken_seconds),
      completedAt: String(row.completed_at),
      languageUsed: row.language_used as Language,
      autoSubmitted: Boolean(row.auto_submitted),
      startedAt: String(row.started_at),
      seriesId: row.series_id ? String(row.series_id) : undefined,
      quizVersion: row.quiz_version === null ? undefined : Number(row.quiz_version),
      contentVersion: row.content_version ? String(row.content_version) : undefined,
      passingPercentage: Number(row.passing_percentage),
    }));
  }

  async loadExamTaskKeys(): Promise<{ planId: string; taskKey: string }[]> {
    if (!this.auth.approved()) return [];
    const { data } = await this.supabase
      .from('exam_plan_task_progress')
      .select('plan_id,task_key')
      .eq('completed', true);
    return (data ?? []).map(row => ({ planId: String(row.plan_id), taskKey: String(row.task_key) }));
  }

  async saveStudyProgress(contentId: string, language: Language, completed: boolean, scrollPercent = 100) {
    const userId = this.auth.user()?.id;
    if (!userId || !this.auth.approved()) return;
    const now = new Date().toISOString();
    await this.supabase.from('study_progress').upsert(
      {
        user_id: userId,
        content_id: contentId,
        state: completed ? 'completed' : 'in_progress',
        scroll_percent: scrollPercent,
        language_last_used: language,
        last_opened_at: now,
        completed_at: completed ? now : null,
        updated_at: now,
      },
      { onConflict: 'user_id,content_id' },
    );
  }

  async submitAttempt(attempt: Attempt) {
    if (!this.auth.approved() || !attempt.answers) return;
    const item = this.content.getItemById(attempt.quizId);
    const { error } = await this.supabase.rpc('submit_quiz_attempt', {
      payload: {
        attempt_id: attempt.id,
        quiz_id: attempt.quizId,
        series_id: attempt.seriesId ?? null,
        language_used: attempt.languageUsed,
        quiz_version: attempt.quizVersion ?? null,
        content_version: attempt.contentVersion ?? null,
        started_at: attempt.startedAt,
        completed_at: attempt.completedAt,
        auto_submitted: attempt.autoSubmitted,
        time_taken_seconds: attempt.elapsedSeconds,
        total_questions: attempt.total,
        correct_count: attempt.correct,
        wrong_count: attempt.wrong,
        unanswered_count: attempt.unanswered,
        score_percent: attempt.scorePercentage,
        passing_percentage: attempt.passingPercentage,
        passed: attempt.passed,
        curriculum_id: item?.curriculum ?? null,
        grade: item?.grade ?? null,
        subject_id: item?.subject ?? null,
        chapter_id: item?.chapter ?? null,
        topic_id: item?.topic ?? null,
        answers: attempt.answers.map(answer => ({
          question_id: answer.questionId,
          selected_option_id: answer.selectedOptionId,
          correct_option_id: answer.correctOptionId,
          is_correct: answer.isCorrect,
          hint_used: answer.hintUsed,
          time_spent_seconds: answer.timeSpentSeconds,
          answered_at: answer.answeredAt,
        })),
      },
    });
    if (error) console.warn('Unable to synchronize this quiz attempt. It remains saved on this device.');
  }

  async saveExamTask(planId: string, planDate: string, taskKey: string, taskType: string, completed: boolean) {
    const userId = this.auth.user()?.id;
    if (!userId || !this.auth.approved()) return;
    const now = new Date().toISOString();
    await this.supabase.from('exam_plan_task_progress').upsert(
      {
        user_id: userId,
        plan_id: planId,
        plan_date: planDate,
        task_key: taskKey,
        task_type: taskType,
        completed,
        completed_at: completed ? now : null,
        updated_at: now,
      },
      { onConflict: 'user_id,plan_id,plan_date,task_key' },
    );
  }

  async wrongQuestionStats(): Promise<WrongQuestionStat[]> {
    if (!this.auth.approved()) return [];
    const { data } = await this.supabase
      .from('wrong_question_stats')
      .select('quiz_id,question_id,attempts,wrong_count,last_wrong_at');
    return (data ?? []) as WrongQuestionStat[];
  }

  async loadBookmarks(): Promise<Bookmark[]> {
    if (!this.auth.approved()) return [];
    const { data, error } = await this.supabase
      .from('bookmarks')
      .select('content_id,resource_type,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => ({
      contentId: String(row.content_id),
      resourceType: row.resource_type as Bookmark['resourceType'],
      createdAt: String(row.created_at),
    }));
  }

  async addBookmark(contentId: string, resourceType: Bookmark['resourceType']): Promise<void> {
    const userId = this.approvedUserId();
    if (!userId) throw new Error('Approved account required');
    const { error } = await this.supabase
      .from('bookmarks')
      .insert({ user_id: userId, content_id: contentId, resource_type: resourceType });
    if (error) throw error;
  }

  async removeBookmark(contentId: string): Promise<void> {
    if (!this.approvedUserId()) throw new Error('Approved account required');
    const { error } = await this.supabase.from('bookmarks').delete().eq('content_id', contentId);
    if (error) throw error;
  }

  async loadLearningSummary(): Promise<LearningSummary> {
    const { data, error } = await this.supabase.rpc('get_my_learning_summary');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return mapLearningSummary(row);
  }

  async loadLeaderboard(query: LeaderboardQuery, ownRank = false): Promise<LeaderboardRow[]> {
    const parameters = {
      p_scope: query.scope,
      p_grade: query.grade ?? null,
      p_subject: query.subject ?? null,
      p_topic: query.topic ?? null,
      ...(ownRank ? {} : { p_limit: 100 }),
    };
    const { data, error } = await this.supabase.rpc(
      ownRank ? 'get_my_leaderboard_rank' : 'get_leaderboard',
      parameters,
    );
    if (error) throw error;
    return mapLeaderboardRows(data);
  }
}

export function mapLeaderboardRows(value: unknown): LeaderboardRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row: Record<string, unknown>) => ({
    rank: Number(row['rank']),
    displayName: String(row['display_name']),
    points: Number(row['points']),
    averageScore: Number(row['average_score']),
    quizzesCompleted: Number(row['quizzes_completed']),
    correctAnswers: Number(row['correct_answers']),
    isCurrentUser: Boolean(row['is_current_user']),
  }));
}

export function mapLearningSummary(value: unknown): LearningSummary {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    lessonsStarted: Number(row['lessons_started'] ?? 0),
    lessonsCompleted: Number(row['lessons_completed'] ?? 0),
    quizAttempts: Number(row['quiz_attempts'] ?? 0),
    uniqueQuizzesAttempted: Number(row['unique_quizzes_attempted'] ?? 0),
    questionsAnswered: Number(row['questions_answered'] ?? 0),
    correctAnswers: Number(row['correct_answers'] ?? 0),
    wrongAnswers: Number(row['wrong_answers'] ?? 0),
    unansweredAnswers: Number(row['unanswered_answers'] ?? 0),
    averageScore: Number(row['average_score'] ?? 0),
    bestScore: Number(row['best_score'] ?? 0),
  };
}
