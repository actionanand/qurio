-- Run as an approved user. RLS must expose only auth.uid() rows.
select b.* from public.bookmarks b order by b.created_at desc;
select count(*) as visible_other_user_bookmarks from public.bookmarks where user_id<>auth.uid();

-- Run inside a transaction if you want a reversible write check.
begin;
insert into public.bookmarks(user_id,content_id,resource_type)
values(auth.uid(),'verification-content-id','note') on conflict do nothing;
select * from public.bookmarks where content_id='verification-content-id';
delete from public.bookmarks where content_id='verification-content-id';
rollback;
