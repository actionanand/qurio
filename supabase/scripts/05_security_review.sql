-- Read-only RLS, policy, grant, and SECURITY DEFINER review.

select
  namespace.nspname as schema_name,
  tables.relname as object_name,
  tables.relkind as object_kind,
  tables.relrowsecurity as rls_enabled,
  tables.relforcerowsecurity as rls_forced
from pg_class as tables
join pg_namespace as namespace on namespace.oid = tables.relnamespace
where namespace.nspname = 'public'
  and tables.relkind in ('r', 'v')
order by tables.relname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select
  namespace.nspname as schema_name,
  procedures.proname as function_name,
  pg_get_function_identity_arguments(procedures.oid) as arguments,
  procedures.prosecdef as security_definer,
  procedures.proconfig as function_settings
from pg_proc as procedures
join pg_namespace as namespace on namespace.oid = procedures.pronamespace
where namespace.nspname = 'public'
order by procedures.proname;
