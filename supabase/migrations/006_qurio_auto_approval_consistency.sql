-- 006_qurio_auto_approval_consistency.sql
-- Fix auto-approval consistency and repair verified users left pending.

begin;

create or replace function public.owner_set_auto_approval(enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  previous_value boolean;
begin
  select * into actor
  from public.profiles
  where id=auth.uid() and status='approved' and role='owner';
  if not found then raise exception 'Owner access required'; end if;

  select auto_approve_verified_users into previous_value
  from public.app_settings where id=true for update;

  update public.app_settings
  set auto_approve_verified_users=enabled,
      updated_by=actor.id,
      updated_at=now()
  where id=true;

  if previous_value is distinct from enabled then
    insert into public.account_audit_log(
      target_user_id,target_email,target_display_name,
      actor_user_id,actor_email,actor_role,
      action,previous_role,new_role,reason
    ) values(
      actor.id,actor.email,actor.display_name,
      actor.id,actor.email,actor.role,
      case when enabled then 'auto_approval_enabled' else 'auto_approval_disabled' end,
      actor.role,actor.role,
      'Owner changed the verified-user approval policy'
    );
  end if;

  if enabled then
    for target in
      select * from public.profiles
      where role='user'
        and status='pending'
        and email_verified_at is not null
      for update
    loop
      update public.profiles
      set status='approved',
          status_reason=null,
          status_changed_by=null,
          status_changed_at=now(),
          updated_at=now()
      where id=target.id;

      insert into public.account_audit_log(
        target_user_id,target_email,target_display_name,
        actor_user_id,actor_email,actor_role,
        action,previous_status,new_status,previous_role,new_role,reason
      ) values(
        target.id,target.email,target.display_name,
        null,null,null,
        'auto_approve',
        target.status,'approved',target.role,target.role,
        'System auto-approved verified user because automatic approval is enabled'
      );
    end loop;
  end if;
end $$;

revoke all on function public.owner_set_auto_approval(boolean) from public;
grant execute on function public.owner_set_auto_approval(boolean) to authenticated;

create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles%rowtype;
  automatic boolean := false;
begin
  update public.profiles
  set email=new.email,
      email_verified_at=new.email_confirmed_at,
      updated_at=now()
  where id=new.id
  returning * into target;

  if not found then return new; end if;

  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    insert into public.account_audit_log(
      target_user_id,target_email,target_display_name,
      action,new_status,new_role
    ) values(
      target.id,target.email,target.display_name,
      'email_verified',target.status,target.role
    );
  end if;

  select auto_approve_verified_users into automatic
  from public.app_settings where id=true;

  if coalesce(automatic,false)
     and new.email_confirmed_at is not null
     and target.role='user'
     and target.status='pending' then

    update public.profiles
    set status='approved',
        status_reason=null,
        status_changed_by=null,
        status_changed_at=now(),
        updated_at=now()
    where id=target.id;

    insert into public.account_audit_log(
      target_user_id,target_email,target_display_name,
      actor_user_id,actor_email,actor_role,
      action,previous_status,new_status,previous_role,new_role,reason
    ) values(
      target.id,target.email,target.display_name,
      null,null,null,
      'auto_approve',
      target.status,'approved',target.role,target.role,
      'System auto-approved user after email verification'
    );
  end if;

  return new;
end $$;

revoke all on function public.handle_auth_user_updated() from public;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email,email_confirmed_at on auth.users
for each row execute function public.handle_auth_user_updated();

do $$
declare
  automatic boolean := false;
  target public.profiles%rowtype;
begin
  select auto_approve_verified_users into automatic
  from public.app_settings where id=true;

  if coalesce(automatic,false) then
    for target in
      select * from public.profiles
      where role='user'
        and status='pending'
        and email_verified_at is not null
      for update
    loop
      update public.profiles
      set status='approved',
          status_reason=null,
          status_changed_by=null,
          status_changed_at=now(),
          updated_at=now()
      where id=target.id;

      insert into public.account_audit_log(
        target_user_id,target_email,target_display_name,
        actor_user_id,actor_email,actor_role,
        action,previous_status,new_status,previous_role,new_role,reason
      ) values(
        target.id,target.email,target.display_name,
        null,null,null,
        'auto_approve',
        target.status,'approved',target.role,target.role,
        'System repaired verified pending user while automatic approval was enabled'
      );
    end loop;
  end if;
end $$;

commit;
