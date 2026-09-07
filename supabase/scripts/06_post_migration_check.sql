-- Read-only check for the objects expected after migrations 001-004.

with expected(object_name, object_kind) as (
  values
    ('profiles', 'table'),
    ('account_audit_log', 'table'),
    ('app_settings', 'table'),
    ('user_settings', 'table'),
    ('study_progress', 'table'),
    ('quiz_attempts', 'table'),
    ('quiz_attempt_answers', 'table'),
    ('exam_plan_task_progress', 'table'),
    ('wrong_question_stats', 'view')
), actual as (
  select table_name as object_name, case when table_type = 'VIEW' then 'view' else 'table' end as object_kind
  from information_schema.tables
  where table_schema = 'public'
)
select expected.object_name, expected.object_kind, (actual.object_name is not null) as exists
from expected
left join actual using (object_name, object_kind)
order by expected.object_kind, expected.object_name;

with expected(function_name) as (
  values
    ('current_user_is_staff'),
    ('current_user_is_owner'),
    ('current_user_is_approved'),
    ('admin_approve_user'),
    ('admin_deny_user'),
    ('admin_suspend_user'),
    ('admin_reactivate_user'),
    ('owner_promote_admin'),
    ('owner_demote_admin'),
    ('owner_set_auto_approval'),
    ('update_my_profile'),
    ('submit_quiz_attempt')
), actual as (
  select routine_name as function_name
  from information_schema.routines
  where specific_schema = 'public'
)
select expected.function_name, (actual.function_name is not null) as exists
from expected
left join actual using (function_name)
order by expected.function_name;

select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.account_audit_log) as audit_events;
