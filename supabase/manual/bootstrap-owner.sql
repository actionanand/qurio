-- Replace <OWNER_EMAIL> before running. Run exactly once after that account verifies its email.
begin;
do $$
declare target public.profiles%rowtype;
begin
  if exists(select 1 from public.profiles where role='owner') then raise exception 'A Qurio Owner already exists'; end if;
  select * into target from public.profiles where lower(email)=lower('<OWNER_EMAIL>') for update;
  if not found then raise exception 'No profile found for the supplied email'; end if;
  if target.email_verified_at is null then raise exception 'Owner email must be verified first'; end if;
  update public.profiles set role='owner',status='approved',status_reason=null,role_changed_by=target.id,role_changed_at=now(),status_changed_by=target.id,status_changed_at=now(),updated_at=now() where id=target.id;
  insert into public.account_audit_log(target_user_id,target_email,target_display_name,actor_user_id,actor_email,actor_role,action,previous_status,new_status,previous_role,new_role)
  values(target.id,target.email,target.display_name,target.id,target.email,'owner','owner_bootstrap',target.status,'approved',target.role,'owner');
end $$;
commit;
