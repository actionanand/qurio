# Viewing and querying Qurio data in Supabase

This guide explains how to inspect Qurio's live database without changing data. Run the examples in the Supabase project's **SQL Editor** after applying the repository migrations.

Ready-to-run versions of the most useful queries are also organized under [`supabase/scripts`](../supabase/scripts/README.md). Versioned schema changes remain under `supabase/migrations`, while one-time and destructive operations remain under `supabase/manual`.

## Dashboard locations

- **Table Editor** shows rows and columns visually. Select the `public` schema, then choose a Qurio table.
- **Authentication → Users** shows Supabase Auth accounts. Auth users live in `auth.users`, not `public.profiles`.
- **SQL Editor** runs PostgreSQL queries and is the best place for joins, counts, schema inspection, and diagnostics.
- **Database → Policies** shows Row Level Security policies.
- **Database → Functions** shows database functions and RPCs.
- **Edge Functions** shows deployed `admin-delete-user` and `admin-resend-verification` functions and their logs.

The SQL Editor normally has elevated database privileges. It can therefore return rows that an authenticated browser client cannot see. A successful SQL Editor query does not prove that browser grants or RLS permit the same query.

### Quick start

1. Open the correct project in the Supabase Dashboard.
2. Select **Table Editor** and choose the `public` schema to browse Qurio tables and rows.
3. Select **Authentication → Users** to browse registered Auth accounts.
4. To run a query, select **SQL Editor → New query**, paste one SQL block from this guide, and choose **Run**.
5. Read the result grid below the editor. Query results do not modify data when the statement starts with `select`.

If a learner table is missing, apply `003_qurio_learner_state.sql` before using its examples. If a query reports `permission denied` from application code but succeeds in SQL Editor, inspect that table's grants, RLS status, policies, and the current user's live `profiles.status`.

## Qurio tables and views

| Object                           | Purpose                                               | Important relationship                 |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| `auth.users`                     | Supabase identities, verification, and sign-in state  | Parent account record                  |
| `public.profiles`                | Qurio name, role, approval status, and status reason  | `id → auth.users.id`                   |
| `public.account_audit_log`       | Permanent account and administrator action snapshots  | Intentionally survives user deletion   |
| `public.app_settings`            | Owner-controlled application policies                 | Singleton automatic-approval setting   |
| `public.user_settings`           | Language, theme, curriculum, grade, and selected plan | One row per user                       |
| `public.study_progress`          | Reading/open/completion state by content ID           | One row per user and content ID        |
| `public.quiz_attempts`           | One completed quiz result                             | Parent of attempt answers              |
| `public.quiz_attempt_answers`    | Selected/correct option IDs and hint usage            | Child of `quiz_attempts`               |
| `public.exam_plan_task_progress` | Completion of plan-only tasks                         | One row per user, plan, date, and task |
| `public.wrong_question_stats`    | Derived wrong-answer totals                           | Security-invoker view over answer rows |

Markdown, quiz questions, explanations, and answer text are not stored in Supabase. Supabase contains stable learning-content IDs and private user state only.

## Discover the schema

List Qurio tables and views:

```sql
select
  table_schema,
  table_name,
  table_type
from information_schema.tables
where table_schema = 'public'
order by table_type, table_name;
```

List columns, types, and nullable fields for one table:

```sql
select
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;
```

Change `'profiles'` to another table name when needed.

List indexes:

```sql
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

List Qurio enum values:

```sql
select
  type_name.typname as enum_name,
  enum_value.enumlabel as value
from pg_type as type_name
join pg_enum as enum_value on enum_value.enumtypid = type_name.oid
join pg_namespace as namespace on namespace.oid = type_name.typnamespace
where namespace.nspname = 'public'
order by enum_name, enum_value.enumsortorder;
```

## Basic query patterns

Return a small result set first:

```sql
select *
from public.profiles
order by created_at desc
limit 25;
```

Select only useful columns:

```sql
select id, display_name, email, role, status, email_verified_at, created_at
from public.profiles
order by created_at desc;
```

Filter and sort:

```sql
select display_name, email, status, email_verified_at
from public.profiles
where status = 'pending'
order by created_at;
```

Find one email case-insensitively:

```sql
select id, display_name, email, role, status, email_verified_at
from public.profiles
where lower(email) = lower('learner@example.com');
```

Replace example values before running a query. Keep string values inside single quotes.

## Account and approval queries

View Auth users without selecting password-related internal columns:

```sql
select id, email, email_confirmed_at, created_at, last_sign_in_at
from auth.users
order by created_at desc;
```

View Auth and Qurio account state together:

```sql
select
  users.id,
  users.email,
  users.email_confirmed_at as auth_email_confirmed_at,
  profiles.display_name,
  profiles.role,
  profiles.status,
  profiles.email_verified_at,
  profiles.status_reason,
  profiles.created_at
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
order by users.created_at desc;
```

Find unverified accounts:

```sql
select display_name, email, status, created_at
from public.profiles
where email_verified_at is null
order by created_at;
```

Find verified accounts still waiting for approval:

```sql
select id, display_name, email, email_verified_at, created_at
from public.profiles
where status = 'pending'
  and email_verified_at is not null
order by email_verified_at;
```

Count accounts by role and status:

```sql
select role, status, count(*) as accounts
from public.profiles
group by role, status
order by role, status;
```

Check the single-Owner and three-Admin limits:

```sql
select
  count(*) filter (where role = 'owner') as owners,
  count(*) filter (where role = 'admin') as admins
from public.profiles;
```

## Audit queries

Latest account events:

```sql
select
  created_at,
  action,
  target_display_name,
  target_email,
  actor_email,
  actor_role,
  previous_status,
  new_status,
  previous_role,
  new_role,
  reason
from public.account_audit_log
order by created_at desc
limit 100;
```

Events for one account email:

```sql
select *
from public.account_audit_log
where lower(target_email) = lower('learner@example.com')
order by created_at desc;
```

Count actions:

```sql
select action, count(*) as events
from public.account_audit_log
group by action
order by events desc, action;
```

## Learner-state queries

Settings with account identity:

```sql
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
```

Recent study progress:

```sql
select
  profiles.email,
  progress.content_id,
  progress.state,
  progress.scroll_percent,
  progress.language_last_used,
  progress.last_opened_at,
  progress.completed_at
from public.study_progress as progress
join public.profiles as profiles on profiles.id = progress.user_id
order by progress.last_opened_at desc
limit 100;
```

Recent quiz attempts:

```sql
select
  profiles.email,
  attempts.quiz_id,
  attempts.completed_at,
  attempts.correct_count,
  attempts.wrong_count,
  attempts.unanswered_count,
  attempts.score_percent,
  attempts.passed,
  attempts.auto_submitted
from public.quiz_attempts as attempts
join public.profiles as profiles on profiles.id = attempts.user_id
order by attempts.completed_at desc
limit 100;
```

Answers for one attempt:

```sql
select
  question_id,
  selected_option_id,
  correct_option_id,
  is_correct,
  hint_used,
  time_spent_seconds,
  answered_at
from public.quiz_attempt_answers
where attempt_id = '<ATTEMPT_UUID>'
order by question_id;
```

Wrong-question statistics:

```sql
select
  profiles.email,
  stats.quiz_id,
  stats.question_id,
  stats.attempts,
  stats.wrong_count,
  stats.last_wrong_at
from public.wrong_question_stats as stats
join public.profiles as profiles on profiles.id = stats.user_id
order by stats.wrong_count desc, stats.last_wrong_at desc;
```

Exam-plan task progress:

```sql
select
  profiles.email,
  tasks.plan_id,
  tasks.plan_date,
  tasks.task_type,
  tasks.task_key,
  tasks.completed,
  tasks.completed_at
from public.exam_plan_task_progress as tasks
join public.profiles as profiles on profiles.id = tasks.user_id
order by tasks.plan_date desc, tasks.task_key;
```

## Row counts

After all migrations exist, this query gives a quick database summary:

```sql
select 'auth.users' as object_name, count(*) as rows from auth.users
union all select 'profiles', count(*) from public.profiles
union all select 'account_audit_log', count(*) from public.account_audit_log
union all select 'app_settings', count(*) from public.app_settings
union all select 'user_settings', count(*) from public.user_settings
union all select 'study_progress', count(*) from public.study_progress
union all select 'quiz_attempts', count(*) from public.quiz_attempts
union all select 'quiz_attempt_answers', count(*) from public.quiz_attempt_answers
union all select 'exam_plan_task_progress', count(*) from public.exam_plan_task_progress
order by object_name;
```

## Inspect RLS, policies, and grants

Check whether RLS is enabled:

```sql
select
  namespace.nspname as schema_name,
  tables.relname as table_name,
  tables.relrowsecurity as rls_enabled,
  tables.relforcerowsecurity as rls_forced
from pg_class as tables
join pg_namespace as namespace on namespace.oid = tables.relnamespace
where namespace.nspname = 'public'
  and tables.relkind = 'r'
order by tables.relname;
```

List policies:

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

List table grants for browser roles:

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

List callable public functions:

```sql
select
  routines.routine_name,
  routines.security_type,
  routines.data_type
from information_schema.routines as routines
where routines.specific_schema = 'public'
order by routines.routine_name;
```

These checks are useful after every migration. Qurio combines explicit grants with RLS; a policy alone does not grant table access.

## Querying from the Angular client

Application code should use the shared `SupabaseService` or a higher-level repository. Do not create another client. Browser queries run as `anon` or the signed-in `authenticated` user and are limited by grants and RLS.

Read the signed-in user's profile:

```ts
const { data, error } = await supabase
  .from('profiles')
  .select('id,email,display_name,role,status,email_verified_at,status_reason')
  .eq('id', user.id)
  .single();
```

Read the signed-in user's wrong-question statistics:

```ts
const { data, error } = await supabase
  .from('wrong_question_stats')
  .select('quiz_id,question_id,attempts,wrong_count,last_wrong_at')
  .order('wrong_count', { ascending: false });
```

Use the transactional quiz RPC rather than inserting attempts and answers separately:

```ts
const { data: attemptId, error } = await supabase.rpc('submit_quiz_attempt', {
  payload,
});
```

Never update `profiles.role` or `profiles.status` from browser code. Use the Admin Control Center, whose service calls the restricted account RPCs. Hard deletion and staff verification resend must go through their Edge Functions.

## Safe inspection habits

- Use `select` queries while exploring.
- Add `limit 25` when opening an unfamiliar or large table.
- Select named columns when inspecting Auth or personal information.
- Use disposable test accounts for authentication and authorization tests.
- Verify the selected Supabase project before running a mutation.
- Do not run `delete`, `truncate`, `drop`, `alter`, or `update` merely to inspect data.
- Keep manual destructive scripts under `supabase/manual` and review them before execution.

For a deliberate full reset, use `supabase/manual/reset-all-data.sql`. It permanently deletes every Auth account, learner row, profile, and audit event while preserving the schema.

Official references: [Database overview](https://supabase.com/docs/guides/database/overview), [Tables and data](https://supabase.com/docs/guides/database/tables), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api).
