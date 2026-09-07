-- Replace <ATTEMPT_UUID> before running. Read-only quiz attempt and answer details.

select
  attempts.id,
  profiles.email,
  attempts.quiz_id,
  attempts.series_id,
  attempts.started_at,
  attempts.completed_at,
  attempts.time_taken_seconds,
  attempts.total_questions,
  attempts.correct_count,
  attempts.wrong_count,
  attempts.unanswered_count,
  attempts.score_percent,
  attempts.passing_percentage,
  attempts.passed,
  attempts.auto_submitted
from public.quiz_attempts as attempts
join public.profiles as profiles on profiles.id = attempts.user_id
where attempts.id = '<ATTEMPT_UUID>'::uuid;

select
  question_id,
  selected_option_id,
  correct_option_id,
  is_correct,
  hint_used,
  time_spent_seconds,
  answered_at
from public.quiz_attempt_answers
where attempt_id = '<ATTEMPT_UUID>'::uuid
order by question_id;
