-- Mirrors the foundation already applied to the live Qurio project.
-- Idempotent where practical and never drops application data.
begin;

do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'user');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.account_status as enum ('pending', 'approved', 'denied', 'suspended');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.app_role not null default 'user',
  status public.account_status not null default 'pending',
  email_verified_at timestamptz,
  status_reason text,
  status_changed_by uuid references auth.users(id) on delete set null,
  status_changed_at timestamptz,
  role_changed_by uuid references auth.users(id) on delete set null,
  role_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_lower_uidx on public.profiles ((lower(email)));
create unique index if not exists profiles_single_owner_uidx on public.profiles (role) where role = 'owner';
create index if not exists profiles_status_idx on public.profiles(status);
create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.account_audit_log (
  id bigint generated always as identity primary key,
  target_user_id uuid,
  target_email text,
  target_display_name text,
  actor_user_id uuid,
  actor_email text,
  actor_role public.app_role,
  action text not null,
  previous_status public.account_status,
  new_status public.account_status,
  previous_role public.app_role,
  new_role public.app_role,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists account_audit_target_idx on public.account_audit_log(target_user_id);
create index if not exists account_audit_created_idx on public.account_audit_log(created_at desc);
create index if not exists account_audit_actor_idx on public.account_audit_log(actor_user_id, created_at desc);
create index if not exists account_audit_action_idx on public.account_audit_log(action, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_display_name text;
begin
  v_display_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'User');
  insert into public.profiles(id,email,display_name,role,status,email_verified_at)
  values(new.id,new.email,v_display_name,'user','pending',new.email_confirmed_at)
  on conflict(id) do nothing;
  insert into public.account_audit_log(target_user_id,target_email,target_display_name,action,new_status,new_role)
  values(new.id,new.email,v_display_name,'signup','pending','user');
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_display_name text;
begin
  update public.profiles set email=new.email,email_verified_at=new.email_confirmed_at,updated_at=now() where id=new.id;
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select display_name into v_display_name from public.profiles where id=new.id;
    insert into public.account_audit_log(target_user_id,target_email,target_display_name,action)
    values(new.id,new.email,v_display_name,'email_verified');
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email,email_confirmed_at on auth.users
for each row execute function public.handle_auth_user_updated();

create or replace function public.current_user_is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='approved' and p.role in ('owner','admin'));
$$;
create or replace function public.current_user_is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='approved' and p.role='owner');
$$;

alter table public.profiles enable row level security;
alter table public.account_audit_log enable row level security;
drop policy if exists profiles_select_own_or_staff on public.profiles;
drop policy if exists profiles_read_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles for select to authenticated
using(id=auth.uid() or public.current_user_is_staff());
drop policy if exists audit_owner_select on public.account_audit_log;
drop policy if exists audit_owner_read on public.account_audit_log;
create policy audit_owner_select on public.account_audit_log for select to authenticated
using(public.current_user_is_owner());

grant usage on schema public to authenticated, service_role;
grant usage on type public.app_role, public.account_status to authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.account_audit_log from anon, authenticated;
grant select on public.profiles, public.account_audit_log to authenticated;
grant select,insert,update,delete on public.profiles, public.account_audit_log to service_role;
revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.handle_auth_user_updated() from public;
revoke all on function public.current_user_is_staff() from public;
revoke all on function public.current_user_is_owner() from public;
grant execute on function public.current_user_is_staff(), public.current_user_is_owner() to authenticated;

commit;
