-- Read-only migration-chain report. Safe to run before or after any Qurio migration.
-- A migration is ready only when every row for that migration and all earlier rows is true.

with expected(migration, object_kind, object_name) as (
  values
    ('001', 'type', 'app_role'),
    ('001', 'type', 'account_status'),
    ('001', 'table', 'profiles'),
    ('001', 'table', 'account_audit_log'),
    ('001', 'function', 'current_user_is_staff'),
    ('001', 'function', 'current_user_is_owner'),
    ('001', 'trigger', 'profiles_set_updated_at'),
    ('001', 'trigger', 'on_auth_user_created'),
    ('001', 'trigger', 'on_auth_user_updated'),
    ('002', 'function', 'enforce_admin_limit'),
    ('002', 'function', 'admin_approve_user'),
    ('002', 'function', 'admin_deny_user'),
    ('002', 'function', 'admin_suspend_user'),
    ('002', 'function', 'admin_reactivate_user'),
    ('002', 'function', 'owner_promote_admin'),
    ('002', 'function', 'owner_demote_admin'),
    ('002', 'function', 'update_my_profile'),
    ('002', 'trigger', 'profiles_enforce_admin_limit'),
    ('003', 'type', 'study_progress_state'),
    ('003', 'table', 'user_settings'),
    ('003', 'table', 'study_progress'),
    ('003', 'table', 'quiz_attempts'),
    ('003', 'table', 'quiz_attempt_answers'),
    ('003', 'table', 'exam_plan_task_progress'),
    ('003', 'view', 'wrong_question_stats'),
    ('003', 'function', 'current_user_is_approved'),
    ('003', 'function', 'submit_quiz_attempt'),
    ('004', 'table', 'app_settings'),
    ('004', 'function', 'owner_set_auto_approval'),
    ('005', 'table', 'bookmarks'),
    ('005', 'column', 'user_settings.practice_reminder_enabled'),
    ('005', 'column', 'user_settings.practice_reminder_time'),
    ('005', 'column', 'user_settings.practice_reminder_days'),
    ('005', 'column', 'quiz_attempts.curriculum_id'),
    ('005', 'column', 'quiz_attempts.grade'),
    ('005', 'column', 'quiz_attempts.subject_id'),
    ('005', 'column', 'quiz_attempts.chapter_id'),
    ('005', 'column', 'quiz_attempts.topic_id'),
    ('005', 'function', 'get_my_learning_summary'),
    ('005', 'function', 'get_leaderboard'),
    ('005', 'function', 'get_my_leaderboard_rank'),
    ('005', 'policy', 'bookmarks_select_own_approved'),
    ('005', 'policy', 'bookmarks_insert_own_approved'),
    ('005', 'policy', 'bookmarks_delete_own_approved')
), checked as (
  select e.*,
    case e.object_kind
      when 'type' then exists (
        select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
        where n.nspname='public' and t.typname=e.object_name
      )
      when 'table' then to_regclass('public.' || e.object_name) is not null
      when 'view' then exists (
        select 1 from information_schema.views
        where table_schema='public' and table_name=e.object_name
      )
      when 'function' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=e.object_name
      )
      when 'trigger' then exists (
        select 1 from pg_trigger t where not t.tgisinternal and t.tgname=e.object_name
      )
      when 'column' then exists (
        select 1 from information_schema.columns c
        where c.table_schema='public'
          and c.table_name=split_part(e.object_name,'.',1)
          and c.column_name=split_part(e.object_name,'.',2)
      )
      when 'policy' then exists (
        select 1 from pg_policies p where p.schemaname='public' and p.policyname=e.object_name
      )
      else false
    end as exists
  from expected e
)
select migration, object_kind, object_name, exists
from checked
order by migration, object_kind, object_name;

-- One row per migration. Apply the next migration only when all preceding stages are complete.
with expected(migration, object_kind, object_name) as (
  values
    ('001','table','profiles'),
    ('001','table','account_audit_log'),
    ('002','function','admin_approve_user'),
    ('002','trigger','profiles_enforce_admin_limit'),
    ('003','table','user_settings'),
    ('003','table','quiz_attempts'),
    ('003','function','current_user_is_approved'),
    ('004','table','app_settings'),
    ('004','function','owner_set_auto_approval'),
    ('005','table','bookmarks'),
    ('005','function','get_leaderboard')
), checked as (
  select e.*,
    case
      when object_kind='table' then to_regclass('public.' || object_name) is not null
      when object_kind='function' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=e.object_name
      )
      when object_kind='trigger' then exists (
        select 1 from pg_trigger t where not t.tgisinternal and t.tgname=e.object_name
      )
      else false
    end as exists
  from expected e
)
select migration, bool_and(exists) as representative_objects_present
from checked
group by migration
order by migration;
