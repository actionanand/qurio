-- Qurio learning experience: reminders, bookmarks, summaries, and leaderboards.
-- App weekday convention: 1=Monday through 7=Sunday.
begin;

alter table public.user_settings
  add column if not exists practice_reminder_enabled boolean not null default false,
  add column if not exists practice_reminder_time time,
  add column if not exists practice_reminder_days smallint[];

alter table public.user_settings drop constraint if exists user_settings_reminder_days_check;
alter table public.user_settings add constraint user_settings_reminder_days_check check (
  practice_reminder_days is null or practice_reminder_days <@ array[1,2,3,4,5,6,7]::smallint[]
);

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text not null,
  resource_type text not null check (resource_type in ('note','quiz')),
  created_at timestamptz not null default now(),
  primary key (user_id, content_id)
);
create index if not exists bookmarks_user_created_idx on public.bookmarks(user_id, created_at desc);
alter table public.bookmarks enable row level security;
drop policy if exists bookmarks_select_own_approved on public.bookmarks;
create policy bookmarks_select_own_approved on public.bookmarks for select to authenticated
using (user_id=auth.uid() and public.current_user_is_approved());
drop policy if exists bookmarks_insert_own_approved on public.bookmarks;
create policy bookmarks_insert_own_approved on public.bookmarks for insert to authenticated
with check (user_id=auth.uid() and public.current_user_is_approved());
drop policy if exists bookmarks_delete_own_approved on public.bookmarks;
create policy bookmarks_delete_own_approved on public.bookmarks for delete to authenticated
using (user_id=auth.uid() and public.current_user_is_approved());

alter table public.quiz_attempts
  add column if not exists curriculum_id text,
  add column if not exists grade integer,
  add column if not exists subject_id text,
  add column if not exists chapter_id text,
  add column if not exists topic_id text;
create index if not exists quiz_attempts_leaderboard_all_idx
  on public.quiz_attempts(user_id, quiz_id, score_percent desc, time_taken_seconds, completed_at desc);
create index if not exists quiz_attempts_leaderboard_grade_idx on public.quiz_attempts(grade, user_id, quiz_id);
create index if not exists quiz_attempts_leaderboard_subject_idx on public.quiz_attempts(subject_id, grade, user_id, quiz_id);
create index if not exists quiz_attempts_leaderboard_topic_idx on public.quiz_attempts(topic_id, subject_id, grade, user_id, quiz_id);

create or replace function public.submit_quiz_attempt(payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  attempt_id uuid := coalesce(nullif(payload->>'attempt_id','')::uuid,gen_random_uuid());
  answer jsonb;
  quiz_id_value text;
  total_value integer;
  correct_value integer;
  wrong_value integer;
  unanswered_value integer;
  score_value numeric;
  expected_score numeric;
begin
  if uid is null or not public.current_user_is_approved() then raise exception 'Approved account required'; end if;
  quiz_id_value := nullif(payload->>'quiz_id','');
  if quiz_id_value is null or jsonb_typeof(payload->'answers') <> 'array' then raise exception 'Invalid quiz attempt payload'; end if;

  total_value := (payload->>'total_questions')::integer;
  correct_value := (payload->>'correct_count')::integer;
  wrong_value := (payload->>'wrong_count')::integer;
  unanswered_value := (payload->>'unanswered_count')::integer;
  score_value := (payload->>'score_percent')::numeric;
  if least(total_value,correct_value,wrong_value,unanswered_value) < 0
     or correct_value + wrong_value + unanswered_value <> total_value then
    raise exception 'Inconsistent quiz attempt counts';
  end if;
  if jsonb_array_length(payload->'answers') <> total_value then raise exception 'Answer count does not match total questions'; end if;
  expected_score := case when total_value=0 then 0 else round(correct_value*100.0/total_value,2) end;
  if abs(score_value-expected_score) > 0.02 then raise exception 'Inconsistent quiz score'; end if;

  insert into public.quiz_attempts(
    id,user_id,quiz_id,series_id,language_used,quiz_version,content_version,
    started_at,completed_at,auto_submitted,time_taken_seconds,total_questions,
    correct_count,wrong_count,unanswered_count,score_percent,passing_percentage,passed,
    curriculum_id,grade,subject_id,chapter_id,topic_id
  ) values(
    attempt_id,uid,quiz_id_value,nullif(payload->>'series_id',''),coalesce(nullif(payload->>'language_used',''),'en'),
    nullif(payload->>'quiz_version','')::integer,nullif(payload->>'content_version',''),
    (payload->>'started_at')::timestamptz,(payload->>'completed_at')::timestamptz,
    coalesce((payload->>'auto_submitted')::boolean,false),coalesce((payload->>'time_taken_seconds')::integer,0),
    total_value,correct_value,wrong_value,unanswered_value,score_value,
    (payload->>'passing_percentage')::numeric,(payload->>'passed')::boolean,
    nullif(payload->>'curriculum_id',''),nullif(payload->>'grade','')::integer,
    nullif(payload->>'subject_id',''),nullif(payload->>'chapter_id',''),nullif(payload->>'topic_id','')
  );
  for answer in select value from jsonb_array_elements(payload->'answers') loop
    if nullif(answer->>'question_id','') is null or nullif(answer->>'correct_option_id','') is null then
      raise exception 'Invalid quiz answer payload';
    end if;
    insert into public.quiz_attempt_answers(
      attempt_id,user_id,quiz_id,question_id,selected_option_id,correct_option_id,
      is_correct,hint_used,time_spent_seconds,answered_at
    ) values(
      attempt_id,uid,quiz_id_value,answer->>'question_id',nullif(answer->>'selected_option_id',''),
      answer->>'correct_option_id',(answer->>'is_correct')::boolean,
      coalesce((answer->>'hint_used')::boolean,false),nullif(answer->>'time_spent_seconds','')::integer,
      nullif(answer->>'answered_at','')::timestamptz
    );
  end loop;
  return attempt_id;
end $$;

create or replace function public.get_my_learning_summary()
returns table(
  lessons_started bigint, lessons_completed bigint, quiz_attempts bigint,
  unique_quizzes_attempted bigint, questions_answered bigint, correct_answers bigint,
  wrong_answers bigint, unanswered_answers bigint, average_score numeric, best_score numeric
) language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.current_user_is_approved() then raise exception 'Approved account required'; end if;
  return query
  select
    (select count(*) from public.study_progress s where s.user_id=auth.uid()),
    (select count(*) from public.study_progress s where s.user_id=auth.uid() and s.state='completed'),
    count(q.id),count(distinct q.quiz_id),
    (select count(*) from public.quiz_attempt_answers a where a.user_id=auth.uid() and a.selected_option_id is not null),
    (select count(*) from public.quiz_attempt_answers a where a.user_id=auth.uid() and a.selected_option_id is not null and a.is_correct),
    (select count(*) from public.quiz_attempt_answers a where a.user_id=auth.uid() and a.selected_option_id is not null and not a.is_correct),
    coalesce(sum(q.unanswered_count),0),
    coalesce(round(avg(q.score_percent),2),0),coalesce(max(q.score_percent),0)
  from public.quiz_attempts q where q.user_id=auth.uid();
end $$;

create or replace function public.get_leaderboard(
  p_scope text, p_grade integer default null, p_subject text default null,
  p_topic text default null, p_limit integer default 100
) returns table(
  rank bigint, display_name text, points numeric, average_score numeric,
  quizzes_completed bigint, correct_answers bigint, is_current_user boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.current_user_is_approved() then raise exception 'Approved account required'; end if;
  if coalesce(p_scope,'') not in ('all','grade','subject','topic') then raise exception 'Invalid leaderboard scope'; end if;
  if p_scope='grade' and p_grade is null then raise exception 'Grade is required'; end if;
  if p_scope='subject' and nullif(p_subject,'') is null then raise exception 'Subject is required'; end if;
  if p_scope='topic' and nullif(p_topic,'') is null then raise exception 'Topic is required'; end if;
  return query
  with eligible as (
    select q.*, row_number() over(
      partition by q.user_id,q.quiz_id order by q.score_percent desc,q.time_taken_seconds,q.completed_at desc,q.id
    ) choice
    from public.quiz_attempts q join public.profiles p on p.id=q.user_id and p.status='approved'
    where p_scope='all'
       or (p_scope='grade' and q.grade=p_grade)
       or (p_scope='subject' and q.subject_id=p_subject and (p_grade is null or q.grade=p_grade))
       or (p_scope='topic' and q.topic_id=p_topic and (p_subject is null or q.subject_id=p_subject) and (p_grade is null or q.grade=p_grade))
  ), totals as (
    select e.user_id,p.display_name,sum(e.score_percent) points,round(avg(e.score_percent),2) average_score,
      count(*) quizzes_completed,sum(e.correct_count) correct_answers,sum(e.time_taken_seconds) total_time
    from eligible e join public.profiles p on p.id=e.user_id where e.choice=1 group by e.user_id,p.display_name
  ), ranked as (
    select row_number() over(order by t.points desc,t.average_score desc,t.quizzes_completed desc,t.total_time,t.display_name,t.user_id) rank_value,t.*
    from totals t
  )
  select r.rank_value,r.display_name,r.points,r.average_score,r.quizzes_completed,r.correct_answers,r.user_id=auth.uid()
  from ranked r order by r.rank_value limit greatest(1,least(coalesce(p_limit,100),100));
end $$;

create or replace function public.get_my_leaderboard_rank(
  p_scope text, p_grade integer default null, p_subject text default null, p_topic text default null
) returns table(
  rank bigint, display_name text, points numeric, average_score numeric,
  quizzes_completed bigint, correct_answers bigint, is_current_user boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.current_user_is_approved() then raise exception 'Approved account required'; end if;
  if coalesce(p_scope,'') not in ('all','grade','subject','topic') then raise exception 'Invalid leaderboard scope'; end if;
  if p_scope='grade' and p_grade is null then raise exception 'Grade is required'; end if;
  if p_scope='subject' and nullif(p_subject,'') is null then raise exception 'Subject is required'; end if;
  if p_scope='topic' and nullif(p_topic,'') is null then raise exception 'Topic is required'; end if;
  return query
  with eligible as (
    select q.*, row_number() over(
      partition by q.user_id,q.quiz_id order by q.score_percent desc,q.time_taken_seconds,q.completed_at desc,q.id
    ) choice
    from public.quiz_attempts q join public.profiles p on p.id=q.user_id and p.status='approved'
    where p_scope='all'
       or (p_scope='grade' and q.grade=p_grade)
       or (p_scope='subject' and q.subject_id=p_subject and (p_grade is null or q.grade=p_grade))
       or (p_scope='topic' and q.topic_id=p_topic and (p_subject is null or q.subject_id=p_subject) and (p_grade is null or q.grade=p_grade))
  ), totals as (
    select e.user_id,p.display_name,sum(e.score_percent) points,round(avg(e.score_percent),2) average_score,
      count(*) quizzes_completed,sum(e.correct_count) correct_answers,sum(e.time_taken_seconds) total_time
    from eligible e join public.profiles p on p.id=e.user_id where e.choice=1 group by e.user_id,p.display_name
  ), ranked as (
    select row_number() over(order by t.points desc,t.average_score desc,t.quizzes_completed desc,t.total_time,t.display_name,t.user_id) rank_value,t.*
    from totals t
  )
  select r.rank_value,r.display_name,r.points,r.average_score,r.quizzes_completed,r.correct_answers,true
  from ranked r where r.user_id=auth.uid();
end
$$;

revoke all on public.bookmarks from anon,authenticated;
grant select,insert,delete on public.bookmarks to authenticated;
revoke all on function public.get_my_learning_summary() from public;
revoke all on function public.get_leaderboard(text,integer,text,text,integer) from public;
revoke all on function public.get_my_leaderboard_rank(text,integer,text,text) from public;
grant execute on function public.get_my_learning_summary() to authenticated;
grant execute on function public.get_leaderboard(text,integer,text,text,integer) to authenticated;
grant execute on function public.get_my_leaderboard_rank(text,integer,text,text) to authenticated;

commit;
