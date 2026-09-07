-- Read-only account overview. Avoid selecting Auth password-related columns.

select
  users.id,
  users.email,
  users.email_confirmed_at as auth_email_confirmed_at,
  users.last_sign_in_at,
  profiles.display_name,
  profiles.role,
  profiles.status,
  profiles.email_verified_at,
  profiles.status_reason,
  profiles.status_changed_at,
  profiles.role_changed_at,
  profiles.created_at
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
order by users.created_at desc;

select role, status, count(*) as accounts
from public.profiles
group by role, status
order by role, status;

select
  count(*) filter (where role = 'owner') as owners,
  count(*) filter (where role = 'admin') as admins,
  count(*) filter (where role = 'user') as users
from public.profiles;
