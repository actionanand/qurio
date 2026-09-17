-- 008_qurio_account_lifecycle.sql
--
-- Correct Qurio account lifecycle:
--
--   signup
--      -> unverified
--
--   email verified + auto approval ON
--      -> approved
--
--   email verified + auto approval OFF
--      -> pending
--      -> manual Owner/Admin approval
--      -> approved
--
-- Also repairs existing inconsistent rows and tightens manual approval.
--
-- Prerequisite:
--   007_qurio_add_unverified_status.sql must already be committed.

begin;

-- ---------------------------------------------------------------------------
-- 1. New-user creation
-- ---------------------------------------------------------------------------
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
    case when initial_status = 'unverified' then null else now() end
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


-- ---------------------------------------------------------------------------
-- 2. Email-verification transition
-- ---------------------------------------------------------------------------
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
  automatic boolean := false;
  next_status public.account_status;
  transition_action text;
begin
  select *
    into target
    from public.profiles
   where id = new.id
   for update;

  if not found then
    return new;
  end if;

  select coalesce(
    (select auto_approve_verified_users
       from public.app_settings
      where id = true),
    false
  )
  into automatic;

  if old.email_confirmed_at is null
     and new.email_confirmed_at is not null then

    insert into public.account_audit_log(
      target_user_id,
      target_email,
      target_display_name,
      action,
      previous_status,
      new_status,
      previous_role,
      new_role,
      reason
    )
    values(
      target.id,
      new.email,
      target.display_name,
      'email_verified',
      target.status,
      target.status,
      target.role,
      target.role,
      'Email verification completed'
    );

    if target.role = 'user'
       and target.status = 'unverified' then

      if automatic then
        next_status := 'approved';
        transition_action := 'auto_approve';
      else
        next_status := 'pending';
        transition_action := 'verification_pending';
      end if;

      update public.profiles
         set email = new.email,
             email_verified_at = new.email_confirmed_at,
             status = next_status,
             status_reason = null,
             status_changed_by = null,
             status_changed_at = now(),
             updated_at = now()
       where id = new.id;

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
        target.id,
        new.email,
        target.display_name,
        null,
        null,
        null,
        transition_action,
        target.status,
        next_status,
        target.role,
        target.role,
        case
          when automatic
            then 'System automatically approved user after email verification'
          else
            'Email verified; account is waiting for Owner/Admin approval'
        end
      );

      return new;
    end if;
  end if;

  update public.profiles
     set email = new.email,
         email_verified_at = new.email_confirmed_at,
         updated_at = now()
   where id = new.id;

  return new;
end
$$;

revoke all on function public.handle_auth_user_updated() from public;


-- ---------------------------------------------------------------------------
-- 3. Manual approval: verified PENDING users only
-- ---------------------------------------------------------------------------
create or replace function public.admin_approve_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
begin
  select *
    into actor
    from public.profiles
   where id = auth.uid()
     and status = 'approved'
     and role in ('owner', 'admin');

  if not found then
    raise exception 'Staff access required';
  end if;

  select *
    into target
    from public.profiles
   where id = target_user_id
   for update;

  if not found or target.role <> 'user' then
    raise exception 'Only user accounts can be approved';
  end if;

  if target.status <> 'pending' then
    raise exception 'Only pending accounts can be approved';
  end if;

  if target.email_verified_at is null then
    raise exception 'Email must be verified before approval';
  end if;

  update public.profiles
     set status = 'approved',
         status_reason = null,
         status_changed_by = actor.id,
         status_changed_at = now(),
         updated_at = now()
   where id = target.id;

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
    target.id,
    target.email,
    target.display_name,
    actor.id,
    actor.email,
    actor.role,
    'approve',
    target.status,
    'approved',
    target.role,
    target.role,
    'Manually approved by Owner/Admin'
  );
end
$$;

revoke all on function public.admin_approve_user(uuid) from public;
grant execute on function public.admin_approve_user(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Reassert automatic-approval behavior
-- ---------------------------------------------------------------------------
create or replace function public.owner_set_auto_approval(enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  previous_value boolean;
begin
  select *
    into actor
    from public.profiles
   where id = auth.uid()
     and status = 'approved'
     and role = 'owner';

  if not found then
    raise exception 'Owner access required';
  end if;

  select auto_approve_verified_users
    into previous_value
    from public.app_settings
   where id = true
   for update;

  update public.app_settings
     set auto_approve_verified_users = enabled,
         updated_by = actor.id,
         updated_at = now()
   where id = true;

  if previous_value is distinct from enabled then
    insert into public.account_audit_log(
      target_user_id,
      target_email,
      target_display_name,
      actor_user_id,
      actor_email,
      actor_role,
      action,
      previous_role,
      new_role,
      reason
    )
    values(
      actor.id,
      actor.email,
      actor.display_name,
      actor.id,
      actor.email,
      actor.role,
      case
        when enabled then 'auto_approval_enabled'
        else 'auto_approval_disabled'
      end,
      actor.role,
      actor.role,
      'Owner changed the verified-user approval policy'
    );
  end if;

  if enabled then
    for target in
      select *
        from public.profiles
       where role = 'user'
         and status = 'pending'
         and email_verified_at is not null
       for update
    loop
      update public.profiles
         set status = 'approved',
             status_reason = null,
             status_changed_by = null,
             status_changed_at = now(),
             updated_at = now()
       where id = target.id;

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
        target.id,
        target.email,
        target.display_name,
        null,
        null,
        null,
        'auto_approve',
        target.status,
        'approved',
        target.role,
        target.role,
        'System automatically approved verified pending user because automatic approval is enabled'
      );
    end loop;
  end if;
end
$$;

revoke all on function public.owner_set_auto_approval(boolean) from public;
grant execute on function public.owner_set_auto_approval(boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Recreate auth.users triggers explicitly
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, email_confirmed_at on auth.users
for each row
execute function public.handle_auth_user_updated();


-- ---------------------------------------------------------------------------
-- 6. Repair existing rows
-- ---------------------------------------------------------------------------

-- Existing pending + unverified rows were never genuinely pending approval.
do $$
declare
  target public.profiles%rowtype;
begin
  for target in
    select *
      from public.profiles
     where role = 'user'
       and status = 'pending'
       and email_verified_at is null
     for update
  loop
    update public.profiles
       set status = 'unverified',
           status_reason = null,
           status_changed_by = null,
           status_changed_at = null,
           updated_at = now()
     where id = target.id;

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
      target.id,
      target.email,
      target.display_name,
      null,
      null,
      null,
      'status_repair',
      'pending',
      'unverified',
      target.role,
      target.role,
      'Migration corrected pre-verification account state from pending to unverified'
    );
  end loop;
end
$$;


-- If auto approval is ON, verified regular users must not remain pending.
do $$
declare
  automatic boolean := false;
  target public.profiles%rowtype;
begin
  select coalesce(
    (select auto_approve_verified_users
       from public.app_settings
      where id = true),
    false
  )
  into automatic;

  if automatic then
    for target in
      select *
        from public.profiles
       where role = 'user'
         and status = 'pending'
         and email_verified_at is not null
       for update
    loop
      update public.profiles
         set status = 'approved',
             status_reason = null,
             status_changed_by = null,
             status_changed_at = now(),
             updated_at = now()
       where id = target.id;

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
        target.id,
        target.email,
        target.display_name,
        null,
        null,
        null,
        'auto_approve',
        target.status,
        'approved',
        target.role,
        target.role,
        'System repaired verified pending user while automatic approval was enabled'
      );
    end loop;
  end if;
end
$$;

commit;
