-- SQL Editor smoke test for protected learner-summary RPCs.
-- Replace <APPROVED_USER_EMAIL> with an existing approved Qurio user's email before running.
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

select
  p.email,
  count(distinct s.content_id) filter (where s.state = 'completed') as lessons_completed,
  count(distinct q.id) as quiz_attempts,
  count(distinct q.quiz_id) as unique_quizzes
from public.profiles p
left join public.study_progress s on s.user_id = p.id
left join public.quiz_attempts q on q.user_id = p.id
where lower(p.email) = lower('<APPROVED_USER_EMAIL>')
group by p.email;

select *
from public.get_my_learning_summary();

rollback;
