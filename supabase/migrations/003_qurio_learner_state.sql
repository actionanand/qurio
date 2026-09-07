do $$ begin
  create type public.study_progress_state as enum ('in_progress', 'completed');
exception when duplicate_object then null; end $$;

create or replace function public.current_user_is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and status='approved');
$$;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_language text,
  theme text,
  selected_curriculum text,
  selected_grade integer,
  selected_exam_plan_id text,
  updated_at timestamptz not null default now(),
  constraint user_settings_theme_check check (theme is null or theme in ('light','dark','system'))
);
create table if not exists public.study_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text not null,
  state public.study_progress_state not null default 'in_progress',
  scroll_percent numeric(5,2) not null default 0 check (scroll_percent between 0 and 100),
  language_last_used text,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id, content_id)
);
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id text not null,
  series_id text,
  language_used text not null,
  quiz_version integer,
  content_version text,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  auto_submitted boolean not null default false,
  time_taken_seconds integer not null check(time_taken_seconds >= 0),
  total_questions integer not null check(total_questions >= 0),
  correct_count integer not null check(correct_count >= 0),
  wrong_count integer not null check(wrong_count >= 0),
  unanswered_count integer not null check(unanswered_count >= 0),
  score_percent numeric(5,2) not null check(score_percent between 0 and 100),
  passing_percentage numeric(5,2) not null check(passing_percentage between 0 and 100),
  passed boolean not null
);
create table if not exists public.quiz_attempt_answers (
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id text not null,
  question_id text not null,
  selected_option_id text,
  correct_option_id text not null,
  is_correct boolean not null,
  hint_used boolean not null default false,
  time_spent_seconds integer check(time_spent_seconds is null or time_spent_seconds >= 0),
  answered_at timestamptz,
  primary key(attempt_id, question_id)
);
create table if not exists public.exam_plan_task_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  plan_date date not null,
  task_key text not null,
  task_type text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id, plan_id, plan_date, task_key)
);

create index if not exists study_progress_user_last_opened_idx on public.study_progress(user_id,last_opened_at desc);
create index if not exists quiz_attempts_user_quiz_idx on public.quiz_attempts(user_id,quiz_id,completed_at desc);
create index if not exists quiz_attempt_answers_user_quiz_question_idx on public.quiz_attempt_answers(user_id,quiz_id,question_id);
create index if not exists exam_plan_progress_user_plan_date_idx on public.exam_plan_task_progress(user_id,plan_id,plan_date);

alter table public.user_settings enable row level security;
alter table public.study_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;
alter table public.exam_plan_task_progress enable row level security;

drop policy if exists user_settings_own_approved on public.user_settings;
create policy user_settings_own_approved on public.user_settings for all to authenticated using(user_id=auth.uid() and public.current_user_is_approved()) with check(user_id=auth.uid() and public.current_user_is_approved());
drop policy if exists study_progress_own_approved on public.study_progress;
create policy study_progress_own_approved on public.study_progress for all to authenticated using(user_id=auth.uid() and public.current_user_is_approved()) with check(user_id=auth.uid() and public.current_user_is_approved());
drop policy if exists quiz_attempts_own_approved on public.quiz_attempts;
create policy quiz_attempts_own_approved on public.quiz_attempts for select to authenticated using(user_id=auth.uid() and public.current_user_is_approved());
drop policy if exists quiz_attempt_answers_own_approved on public.quiz_attempt_answers;
create policy quiz_attempt_answers_own_approved on public.quiz_attempt_answers for select to authenticated using(user_id=auth.uid() and public.current_user_is_approved());
drop policy if exists exam_plan_progress_own_approved on public.exam_plan_task_progress;
create policy exam_plan_progress_own_approved on public.exam_plan_task_progress for all to authenticated using(user_id=auth.uid() and public.current_user_is_approved()) with check(user_id=auth.uid() and public.current_user_is_approved());

create or replace function public.submit_quiz_attempt(payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); attempt_id uuid := coalesce(nullif(payload->>'attempt_id','')::uuid,gen_random_uuid()); answer jsonb; quiz_id_value text;
begin
  if uid is null or not public.current_user_is_approved() then raise exception 'Approved account required'; end if;
  quiz_id_value := nullif(payload->>'quiz_id','');
  if quiz_id_value is null or jsonb_typeof(payload->'answers') <> 'array' then raise exception 'Invalid quiz attempt payload'; end if;
  insert into public.quiz_attempts(id,user_id,quiz_id,series_id,language_used,quiz_version,content_version,started_at,completed_at,auto_submitted,time_taken_seconds,total_questions,correct_count,wrong_count,unanswered_count,score_percent,passing_percentage,passed)
  values(attempt_id,uid,quiz_id_value,nullif(payload->>'series_id',''),coalesce(nullif(payload->>'language_used',''),'en'),nullif(payload->>'quiz_version','')::integer,nullif(payload->>'content_version',''),(payload->>'started_at')::timestamptz,(payload->>'completed_at')::timestamptz,coalesce((payload->>'auto_submitted')::boolean,false),coalesce((payload->>'time_taken_seconds')::integer,0),(payload->>'total_questions')::integer,(payload->>'correct_count')::integer,(payload->>'wrong_count')::integer,(payload->>'unanswered_count')::integer,(payload->>'score_percent')::numeric,(payload->>'passing_percentage')::numeric,(payload->>'passed')::boolean);
  for answer in select value from jsonb_array_elements(payload->'answers') loop
    insert into public.quiz_attempt_answers(attempt_id,user_id,quiz_id,question_id,selected_option_id,correct_option_id,is_correct,hint_used,time_spent_seconds,answered_at)
    values(attempt_id,uid,quiz_id_value,answer->>'question_id',nullif(answer->>'selected_option_id',''),answer->>'correct_option_id',(answer->>'is_correct')::boolean,coalesce((answer->>'hint_used')::boolean,false),nullif(answer->>'time_spent_seconds','')::integer,nullif(answer->>'answered_at','')::timestamptz);
  end loop;
  return attempt_id;
end $$;

create or replace view public.wrong_question_stats with (security_invoker=true) as
select user_id,quiz_id,question_id,count(*) filter(where selected_option_id is not null)::integer as attempts,count(*) filter(where selected_option_id is not null and not is_correct)::integer as wrong_count,max(answered_at) filter(where selected_option_id is not null and not is_correct) as last_wrong_at
from public.quiz_attempt_answers group by user_id,quiz_id,question_id having count(*) filter(where selected_option_id is not null and not is_correct) > 0;

revoke all on public.user_settings,public.study_progress,public.quiz_attempts,public.quiz_attempt_answers,public.exam_plan_task_progress from anon,authenticated;
grant select,insert,update,delete on public.user_settings,public.study_progress,public.exam_plan_task_progress to authenticated;
grant select on public.quiz_attempts,public.quiz_attempt_answers to authenticated;
revoke all on public.wrong_question_stats from anon,authenticated;
grant select on public.wrong_question_stats to authenticated;
revoke all on function public.current_user_is_approved() from public;
revoke all on function public.submit_quiz_attempt(jsonb) from public;
grant execute on function public.current_user_is_approved(),public.submit_quiz_attempt(jsonb) to authenticated;
