import { Service, inject } from '@angular/core';
import type { Appearance } from '../core/preferences.service';
import type { Attempt, Language } from '../core/models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

export interface CloudSettings {
  preferred_language: Language | null;
  theme: Appearance | null;
  selected_curriculum: string | null;
  selected_grade: number | null;
  selected_exam_plan_id: string | null;
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
  approvedUserId() {
    return this.auth.approved() ? (this.auth.user()?.id ?? null) : null;
  }

  async loadSettings(): Promise<CloudSettings | null> {
    if (!this.auth.approved()) return null;
    const { data } = await this.supabase
      .from('user_settings')
      .select('preferred_language,theme,selected_curriculum,selected_grade,selected_exam_plan_id')
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
}
