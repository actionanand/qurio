create or replace function public.enforce_admin_limit()
returns trigger language plpgsql set search_path = '' as $$
declare admin_count integer;
begin
  if new.role = 'admin' and (tg_op = 'INSERT' or old.role <> 'admin') then
    perform pg_advisory_xact_lock(hashtext('qurio-admin-role-limit'));
    select count(*) into admin_count from public.profiles where role='admin' and id <> new.id;
    if admin_count >= 3 then raise exception 'Maximum of 3 Admin accounts reached'; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_enforce_admin_limit on public.profiles;
create trigger profiles_enforce_admin_limit before insert or update of role on public.profiles for each row execute function public.enforce_admin_limit();
revoke all on function public.enforce_admin_limit() from public;

create or replace function public.admin_approve_user(target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid() and status = 'approved' and role in ('owner','admin');
  if not found then raise exception 'Staff access required'; end if;
  select * into target from public.profiles where id = target_user_id for update;
  if not found or target.role <> 'user' then raise exception 'Only user accounts can be approved'; end if;
  if target.email_verified_at is null then raise exception 'Email must be verified before approval'; end if;
  update public.profiles set status='approved', status_reason=null, status_changed_by=actor.id, status_changed_at=now(), updated_at=now() where id=target.id;
  insert into public.account_audit_log(target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,previous_status,new_status,previous_role,new_role)
  values(target.id,target.email,target.display_name,actor.id,actor.email,actor.role,'approve',target.status,'approved',target.role,target.role);
end $$;

create or replace function public.admin_deny_user(target_user_id uuid, reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype;
begin
  if nullif(trim(reason),'') is null then raise exception 'Reason is required'; end if;
  select * into actor from public.profiles where id=auth.uid() and status='approved' and role in ('owner','admin'); if not found then raise exception 'Staff access required'; end if;
  select * into target from public.profiles where id=target_user_id for update; if not found or target.role <> 'user' then raise exception 'Only user accounts can be denied'; end if;
  update public.profiles set status='denied',status_reason=trim(reason),status_changed_by=actor.id,status_changed_at=now(),updated_at=now() where id=target.id;
  insert into public.account_audit_log(target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,previous_status,new_status,previous_role,new_role,reason)
  values(target.id,target.email,target.display_name,actor.id,actor.email,actor.role,'deny',target.status,'denied',target.role,target.role,trim(reason));
end $$;

create or replace function public.admin_suspend_user(target_user_id uuid, reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype;
begin
  if nullif(trim(reason),'') is null then raise exception 'Reason is required'; end if;
  select * into actor from public.profiles where id=auth.uid() and status='approved' and role in ('owner','admin'); if not found then raise exception 'Staff access required'; end if;
  select * into target from public.profiles where id=target_user_id for update; if not found or target.role <> 'user' then raise exception 'Only user accounts can be suspended'; end if;
  update public.profiles set status='suspended',status_reason=trim(reason),status_changed_by=actor.id,status_changed_at=now(),updated_at=now() where id=target.id;
  insert into public.account_audit_log(target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,previous_status,new_status,previous_role,new_role,reason)
  values(target.id,target.email,target.display_name,actor.id,actor.email,actor.role,'suspend',target.status,'suspended',target.role,target.role,trim(reason));
end $$;

create or replace function public.admin_reactivate_user(target_user_id uuid, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype;
begin
  select * into actor from public.profiles where id=auth.uid() and status='approved' and role in ('owner','admin'); if not found then raise exception 'Staff access required'; end if;
  select * into target from public.profiles where id=target_user_id for update; if not found or target.role <> 'user' then raise exception 'Only user accounts can be reactivated'; end if;
  if target.email_verified_at is null then raise exception 'Email must be verified before reactivation'; end if;
  update public.profiles set status='approved',status_reason=null,status_changed_by=actor.id,status_changed_at=now(),updated_at=now() where id=target.id;
  insert into public.account_audit_log(target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,previous_status,new_status,previous_role,new_role,reason)
  values(target.id,target.email,target.display_name,actor.id,actor.email,actor.role,'reactivate',target.status,'approved',target.role,target.role,nullif(trim(reason),''));
end $$;

create or replace function public.owner_promote_admin(target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype; admin_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('qurio-admin-role-limit'));
  select * into actor from public.profiles where id=auth.uid() and status='approved' and role='owner'; if not found then raise exception 'Owner access required'; end if;
  select * into target from public.profiles where id=target_user_id for update; if not found or target.role <> 'user' or target.status <> 'approved' then raise exception 'Target must be an approved user'; end if;
  select count(*) into admin_count from public.profiles where role='admin'; if admin_count >= 3 then raise exception 'Maximum of 3 Admin accounts reached'; end if;
  update public.profiles set role='admin',role_changed_by=actor.id,role_changed_at=now(),updated_at=now() where id=target.id;
  insert into public.account_audit_log(target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,previous_status,new_status,previous_role,new_role)
  values(target.id,target.email,target.display_name,actor.id,actor.email,actor.role,'promote_admin',target.status,target.status,target.role,'admin');
end $$;

create or replace function public.owner_demote_admin(target_user_id uuid, reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype;
begin
  if nullif(trim(reason),'') is null then raise exception 'Reason is required'; end if;
  select * into actor from public.profiles where id=auth.uid() and status='approved' and role='owner'; if not found then raise exception 'Owner access required'; end if;
  select * into target from public.profiles where id=target_user_id for update; if not found or target.role <> 'admin' then raise exception 'Target must be an Admin'; end if;
  update public.profiles set role='user',role_changed_by=actor.id,role_changed_at=now(),updated_at=now() where id=target.id;
  insert into public.account_audit_log(target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,previous_status,new_status,previous_role,new_role,reason)
  values(target.id,target.email,target.display_name,actor.id,actor.email,actor.role,'demote_admin',target.status,target.status,target.role,'user',trim(reason));
end $$;

create or replace function public.update_my_profile(display_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or nullif(trim(display_name),'') is null then raise exception 'A display name is required'; end if;
  update public.profiles set display_name=left(trim($1),120),updated_at=now() where id=auth.uid();
  if not found then raise exception 'Profile not found'; end if;
end $$;

revoke all on function public.admin_approve_user(uuid) from public;
revoke all on function public.admin_deny_user(uuid,text) from public;
revoke all on function public.admin_suspend_user(uuid,text) from public;
revoke all on function public.admin_reactivate_user(uuid,text) from public;
revoke all on function public.owner_promote_admin(uuid) from public;
revoke all on function public.owner_demote_admin(uuid,text) from public;
revoke all on function public.update_my_profile(text) from public;
grant execute on function public.admin_approve_user(uuid), public.admin_deny_user(uuid,text), public.admin_suspend_user(uuid,text), public.admin_reactivate_user(uuid,text), public.owner_promote_admin(uuid), public.owner_demote_admin(uuid,text), public.update_my_profile(text) to authenticated;
