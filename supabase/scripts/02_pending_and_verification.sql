-- Read-only queues corresponding to the Admin Control Center filters.

select id, display_name, email, status, created_at
from public.profiles
where email_verified_at is null
order by created_at;

select id, display_name, email, email_verified_at, created_at
from public.profiles
where status = 'pending'
  and email_verified_at is not null
order by email_verified_at;

select id, display_name, email, role, status, status_reason, status_changed_at
from public.profiles
where status in ('denied', 'suspended')
order by status_changed_at desc nulls last;
