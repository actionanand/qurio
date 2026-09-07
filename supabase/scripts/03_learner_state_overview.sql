-- Requires 003_qurio_learner_state.sql. Read-only per-user state summary.

select
  profiles.id,
  profiles.email,
  count(distinct progress.content_id) filter (where progress.state = 'completed') as completed_content,
  count(distinct attempts.id) as quiz_attempts,
  count(distinct tasks.task_key) filter (where tasks.completed) as completed_plan_tasks,
  max(progress.last_opened_at) as last_content_opened,
  max(attempts.completed_at) as last_quiz_completed
from public.profiles as profiles
left join public.study_progress as progress on progress.user_id = profiles.id
left join public.quiz_attempts as attempts on attempts.user_id = profiles.id
left join public.exam_plan_task_progress as tasks on tasks.user_id = profiles.id
group by profiles.id, profiles.email
order by profiles.email;

select
  profiles.email,
  settings.preferred_language,
  settings.theme,
  settings.selected_curriculum,
  settings.selected_grade,
  settings.selected_exam_plan_id,
  settings.updated_at
from public.user_settings as settings
join public.profiles as profiles on profiles.id = settings.user_id
order by settings.updated_at desc;
