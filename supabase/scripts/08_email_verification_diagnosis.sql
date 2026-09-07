-- Replace <USER_EMAIL>. Read-only diagnosis for email confirmation and profile synchronization.

select
  users.id,
  users.email,
  users.email_confirmed_at,
  users.confirmation_sent_at,
  users.last_sign_in_at,
  profiles.display_name,
  profiles.role,
  profiles.status,
  profiles.email_verified_at,
  profiles.updated_at
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where lower(users.email) = lower('<USER_EMAIL>');

select created_at, action, target_email, previous_status, new_status, reason
from public.account_audit_log
where lower(target_email) = lower('<USER_EMAIL>')
order by created_at desc;

select
  triggers.trigger_name,
  triggers.event_manipulation,
  triggers.action_timing,
  triggers.action_statement
from information_schema.triggers
where triggers.event_object_schema = 'users'
  and triggers.event_object_table = 'users'
order by triggers.trigger_name, triggers.event_manipulation;
