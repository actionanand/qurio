-- SQL Editor smoke test for protected leaderboard RPCs.
-- Replace <APPROVED_USER_EMAIL> with an existing approved Qurio user's email before running.
-- Grade/subject/topic examples below match the current demo content; adjust if needed.
-- This script is transaction-wrapped and always rolls back.

begin;

do $$
begin
  if position('<' in '<APPROVED_USER_EMAIL>') > 0 then
    raise exception 'Replace <APPROVED_USER_EMAIL> before running this test';
  end if;

  if not exists (
    select 1
    from public.profiles
    where lower(email) = lower('<APPROVED_USER_EMAIL>')
      and status = 'approved'
  ) then
    raise exception 'Approved Qurio profile not found for the supplied email';
  end if;
end $$;

select set_config(
  'request.jwt.claim.sub',
  (
    select id::text
    from public.profiles
    where lower(email) = lower('<APPROVED_USER_EMAIL>')
  ),
  true
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    (
      select id::text
      from public.profiles
      where lower(email) = lower('<APPROVED_USER_EMAIL>')
    ),
    'role',
    'authenticated'
  )::text,
  true
);

set local role authenticated;

select
  auth.uid() as auth_uid,
  current_user as postgres_role,
  public.current_user_is_approved() as approved;

select * from public.get_leaderboard('all', null, null, null, 100);
select * from public.get_leaderboard('grade', 5, null, null, 100);
select * from public.get_leaderboard('subject', 5, 'mathematics', null, 100);
select * from public.get_leaderboard('topic', 5, 'mathematics', 'probability', 100);

select * from public.get_my_leaderboard_rank('all', null, null, null);

with ranked as (
  select
    user_id,
    quiz_id,
    score_percent,
    row_number() over (
      partition by user_id, quiz_id
      order by score_percent desc, time_taken_seconds, completed_at desc, id
    ) as choice
  from public.quiz_attempts
)
select
  user_id,
  quiz_id,
  count(*) as attempts,
  count(*) filter (where choice = 1) as leaderboard_attempts,
  max(score_percent) as best_score
from ranked
group by user_id, quiz_id
having count(*) > 1
order by attempts desc;

select
  pg_get_functiondef(
    'public.get_leaderboard(text,integer,text,text,integer)'::regprocedure
  ) like '%p.status=''approved''%' as checks_live_approved_status,
  not (
    proargnames && array['email','user_id']::text[]
  ) as sanitized_output
from pg_proc
where oid =
  'public.get_leaderboard(text,integer,text,text,integer)'::regprocedure;

rollback;
