-- DESTRUCTIVE: permanently removes every Qurio account and all user data.
-- This keeps tables, functions, triggers, RLS policies, and migrations intact.
-- Run only in the intended Supabase project from the SQL Editor.

begin;

-- Deleting Auth users cascades through profiles and every learner-state table.
delete from auth.users;

-- Audit UUIDs intentionally have no Auth foreign keys, so clear them explicitly.
truncate table public.account_audit_log restart identity;

commit;

-- Both values must be zero after the transaction.
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.account_audit_log) as audit_events;
