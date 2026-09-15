-- Run after migration 005. This uses CTE data and function metadata; it does not modify learner rows.
do $$
declare
  calculated_points numeric;
  calculated_quizzes bigint;
  subject_points numeric;
begin
  with attempts(user_id,quiz_id,score_percent,time_taken_seconds,completed_at,grade,subject_id,topic_id) as (
    values
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',10::numeric,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',20,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',30,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',40,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',50,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',60,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',70,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',80,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',90,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-a',100,60,now(),5,'mathematics','probability'),
      ('00000000-0000-0000-0000-000000000001'::uuid,'quiz-b',90,50,now(),5,'science','matter')
  ), best as (
    select *,row_number() over(partition by user_id,quiz_id order by score_percent desc,time_taken_seconds,completed_at desc) choice
    from attempts
  )
  select sum(score_percent),count(*) into calculated_points,calculated_quizzes from best where choice=1;
  if calculated_points<>190 or calculated_quizzes<>2 then raise exception 'Repeated attempts farmed points'; end if;

  with attempts(quiz_id,score_percent,grade,subject_id,topic_id) as (
    values ('quiz-a',100::numeric,5,'mathematics','probability'),('quiz-b',90,5,'science','matter')
  ) select sum(score_percent) into subject_points from attempts where grade=5 and subject_id='mathematics';
  if subject_points<>100 then raise exception 'Subject filtering failed'; end if;

  if exists (
    select 1 from pg_proc
    where oid='public.get_leaderboard(text,integer,text,text,integer)'::regprocedure
      and proargnames && array['email','user_id']::text[]
  ) then raise exception 'Leaderboard exposes a private output field'; end if;
end $$;
