-- Read-only inventory of Qurio tables, views, columns, indexes, and functions.

select table_schema, table_name, table_type
from information_schema.tables
where table_schema in ('public', 'auth')
order by table_schema, table_type, table_name;

select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

select routine_name, routine_type, security_type, data_type
from information_schema.routines
where specific_schema = 'public'
order by routine_name;
