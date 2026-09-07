-- Read-only audit history and action totals.

select
  created_at,
  action,
  target_user_id,
  target_display_name,
  target_email,
  actor_user_id,
  actor_email,
  actor_role,
  previous_status,
  new_status,
  previous_role,
  new_role,
  reason
from public.account_audit_log
order by created_at desc
limit 250;

select action, count(*) as events, min(created_at) as first_event, max(created_at) as latest_event
from public.account_audit_log
group by action
order by events desc, action;
