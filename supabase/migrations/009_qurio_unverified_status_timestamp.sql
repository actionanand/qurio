-- 009_qurio_unverified_status_timestamp.sql
--
-- Purpose:
-- 1. Backfill a meaningful status_changed_at for existing UNVERIFIED accounts.
-- 2. Ensure future signups receive status_changed_at immediately when their
--    initial account status is assigned.
--
-- Existing repaired unverified accounts use created_at as the best historical
-- timestamp because "unverified" is their logical initial status from signup.
--
-- Prerequisites:
--   007_qurio_add_unverified_status.sql
--   008_qurio_account_lifecycle.sql

begin;

-- Backfill existing unverified accounts that currently show no status change
-- time. Their logical unverified status began when the profile was created.
update public.profiles
set status_changed_at = created_at,
    updated_at = now()
where status = 'unverified'
  and status_changed_at is null;

-- Keep the corrected lifecycle from migration 008, but always timestamp the
-- initial status assignment for future accounts.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  automatic boolean := false;
  initial_status public.account_status := 'unverified';
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1),
    'User'
  );

  select coalesce(
    (select auto_approve_verified_users
       from public.app_settings
      where id = true),
    false
  )
  into automatic;

  if new.email_confirmed_at is null then
    initial_status := 'unverified';
  elsif automatic then
    initial_status := 'approved';
  else
    initial_status := 'pending';
  end if;

  insert into public.profiles(
    id,
    email,
    display_name,
    role,
    status,
    email_verified_at,
    status_changed_by,
    status_changed_at
  )
  values(
    new.id,
    new.email,
    v_display_name,
    'user',
    initial_status,
    new.email_confirmed_at,
    null,
    now()
  )
  on conflict(id) do nothing;

  insert into public.account_audit_log(
    target_user_id,
    target_email,
    target_display_name,
    action,
    new_status,
    new_role,
    reason
  )
  values(
    new.id,
    new.email,
    v_display_name,
    'signup',
    initial_status,
    'user',
    case
      when initial_status = 'unverified'
        then 'Account created; waiting for email verification'
      when initial_status = 'approved'
        then 'Account created already verified and automatically approved'
      else
        'Account created already verified and waiting for manual approval'
    end
  );

  -- Rare case: auth.users arrives already verified.
  if new.email_confirmed_at is not null then
    insert into public.account_audit_log(
      target_user_id,
      target_email,
      target_display_name,
      action,
      new_status,
      new_role,
      reason
    )
    values(
      new.id,
      new.email,
      v_display_name,
      'email_verified',
      initial_status,
      'user',
      'Email was already verified when the account was created'
    );

    if initial_status = 'approved' then
      insert into public.account_audit_log(
        target_user_id,
        target_email,
        target_display_name,
        actor_user_id,
        actor_email,
        actor_role,
        action,
        previous_status,
        new_status,
        previous_role,
        new_role,
        reason
      )
      values(
        new.id,
        new.email,
        v_display_name,
        null,
        null,
        null,
        'auto_approve',
        null,
        'approved',
        'user',
        'user',
        'System automatically approved already-verified account at creation'
      );
    end if;
  end if;

  return new;
end
$$;

revoke all on function public.handle_new_auth_user() from public;

-- The existing on_auth_user_created trigger already calls this function.
-- Recreate it explicitly so the live database is unambiguous.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

commit;
