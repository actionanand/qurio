-- SQL Editor smoke test for bookmark RLS and reversible writes.
-- Replace <APPROVED_USER_EMAIL> with an existing approved Qurio user's email before running.
-- The temporary bookmark is removed by ROLLBACK.

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

select set_config(
  'qurio.test.bookmark_content_id',
  'verification-' || gen_random_uuid()::text,
  true
);

set local role authenticated;

select
  auth.uid() as auth_uid,
  current_user as postgres_role,
  public.current_user_is_approved() as approved;

select *
from public.bookmarks
order by created_at desc;

select count(*) as visible_other_user_bookmarks
from public.bookmarks
where user_id <> auth.uid();

insert into public.bookmarks(user_id, content_id, resource_type)
values(
  auth.uid(),
  current_setting('qurio.test.bookmark_content_id'),
  'note'
);

select *
from public.bookmarks
where content_id = current_setting('qurio.test.bookmark_content_id');

delete from public.bookmarks
where content_id = current_setting('qurio.test.bookmark_content_id');

rollback;
