-- Owner-controlled automatic approval for email-verified user accounts.
begin;

create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  auto_approve_verified_users boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id,auto_approve_verified_users)
values(true,false) on conflict(id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_owner_select on public.app_settings;
create policy app_settings_owner_select on public.app_settings for select to authenticated
using(public.current_user_is_owner());

revoke all on public.app_settings from anon,authenticated;
grant select on public.app_settings to authenticated;
grant select,insert,update,delete on public.app_settings to service_role;

create or replace function public.owner_set_auto_approval(enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype; previous_value boolean;
begin
  select * into actor from public.profiles
  where id=auth.uid() and status='approved' and role='owner';
  if not found then raise exception 'Owner access required'; end if;

  select auto_approve_verified_users into previous_value
  from public.app_settings where id=true for update;
  update public.app_settings
  set auto_approve_verified_users=enabled,updated_by=actor.id,updated_at=now()
  where id=true;

  if previous_value is distinct from enabled then
    insert into public.account_audit_log(
      target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,previous_role,new_role,reason
    ) values(
      actor.id,actor.email,actor.display_name,actor.id,actor.email,actor.role,
      case when enabled then 'auto_approval_enabled' else 'auto_approval_disabled' end,
      actor.role,actor.role,'Owner changed the verified-user approval policy'
    );
  end if;

  if enabled then
    for target in
      select * from public.profiles
      where role='user' and status='pending' and email_verified_at is not null
      for update
    loop
      update public.profiles set
        status='approved',status_reason=null,status_changed_by=actor.id,status_changed_at=now(),updated_at=now()
      where id=target.id;
      insert into public.account_audit_log(
        target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,
        previous_status,new_status,previous_role,new_role,reason
      ) values(
        target.id,target.email,target.display_name,actor.id,actor.email,actor.role,'auto_approve',
        target.status,'approved',target.role,target.role,'Automatic approval enabled by Owner'
      );
    end loop;
  end if;
end $$;

revoke all on function public.owner_set_auto_approval(boolean) from public;
grant execute on function public.owner_set_auto_approval(boolean) to authenticated;

-- Preserve verification auditing and apply the live setting when confirmation completes.
create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target public.profiles%rowtype; actor public.profiles%rowtype; automatic boolean := false; automatic_actor_id uuid;
begin
  update public.profiles set
    email=new.email,email_verified_at=new.email_confirmed_at,updated_at=now()
  where id=new.id returning * into target;

  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    insert into public.account_audit_log(
      target_user_id,target_email,target_display_name,action,new_status,new_role
    ) values(target.id,target.email,target.display_name,'email_verified',target.status,target.role);

    select auto_approve_verified_users,updated_by into automatic,automatic_actor_id
    from public.app_settings where id=true;
    if coalesce(automatic,false) and target.role='user' and target.status='pending' then
      select * into actor from public.profiles where id=automatic_actor_id;
      update public.profiles set
        status='approved',status_reason=null,status_changed_by=actor.id,status_changed_at=now(),updated_at=now()
      where id=target.id;
      insert into public.account_audit_log(
        target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,
        previous_status,new_status,previous_role,new_role,reason
      ) values(
        target.id,target.email,target.display_name,actor.id,actor.email,actor.role,'auto_approve',
        target.status,'approved',target.role,target.role,
        'Automatically approved after email verification'
      );
    end if;
  end if;
  return new;
end $$;

revoke all on function public.handle_auth_user_updated() from public;
commit;
