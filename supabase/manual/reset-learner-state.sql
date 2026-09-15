-- DESTRUCTIVE: removes every user's learner state while keeping Auth users,
-- profiles, roles, approval statuses, and account audit history.
-- Requires migrations through 005_qurio_learning_experience.sql.
begin;

truncate table
  public.bookmarks,
  public.quiz_attempt_answers,
  public.quiz_attempts,
  public.study_progress,
  public.exam_plan_task_progress,
  public.user_settings;

commit;

select
  (select count(*) from public.bookmarks) as bookmarks,
  (select count(*) from public.user_settings) as settings,
  (select count(*) from public.study_progress) as study_progress,
  (select count(*) from public.quiz_attempts) as quiz_attempts,
  (select count(*) from public.quiz_attempt_answers) as quiz_answers,
  (select count(*) from public.exam_plan_task_progress) as exam_tasks;
