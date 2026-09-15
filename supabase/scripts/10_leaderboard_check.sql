-- Run as an approved user. Results deliberately contain no email or user UUID.
select * from public.get_leaderboard('all',null,null,null,100);
select * from public.get_leaderboard('grade',5,null,null,100);
select * from public.get_leaderboard('subject',5,'mathematics',null,100);
select * from public.get_leaderboard('topic',5,'mathematics','probability',100);
select * from public.get_my_leaderboard_rank('all',null,null,null);

-- Review best-attempt inputs: ten retries of one quiz must still produce one selected row.
with ranked as (
  select user_id,quiz_id,score_percent,
    row_number() over(partition by user_id,quiz_id order by score_percent desc,time_taken_seconds,completed_at desc,id) as choice
  from public.quiz_attempts
)
select user_id,quiz_id,count(*) as attempts,count(*) filter(where choice=1) as leaderboard_attempts,max(score_percent) as best_score
from ranked group by user_id,quiz_id having count(*)>1 order by attempts desc;

-- Contract checks: both values must be true. The RPC's OUT columns must not include email or user_id.
select
  pg_get_functiondef('public.get_leaderboard(text,integer,text,text,integer)'::regprocedure)
    like '%p.status=''approved''%' as checks_live_approved_status,
  not (proargnames && array['email','user_id']::text[]) as sanitized_output
from pg_proc
where oid='public.get_leaderboard(text,integer,text,text,integer)'::regprocedure;

-- Compare category RPC points with an independent best-attempt calculation for the signed-in user.
with subject_best as (
  select distinct on (quiz_id) quiz_id,score_percent
  from public.quiz_attempts
  where user_id=auth.uid() and grade=5 and subject_id='mathematics'
  order by quiz_id,score_percent desc,time_taken_seconds,completed_at desc,id
), topic_best as (
  select distinct on (quiz_id) quiz_id,score_percent
  from public.quiz_attempts
  where user_id=auth.uid() and grade=5 and subject_id='mathematics' and topic_id='probability'
  order by quiz_id,score_percent desc,time_taken_seconds,completed_at desc,id
)
select
  (select coalesce(sum(score_percent),0) from subject_best) as expected_subject_points,
  (select coalesce(points,0) from public.get_my_leaderboard_rank('subject',5,'mathematics',null)) as actual_subject_points,
  (select coalesce(sum(score_percent),0) from topic_best) as expected_topic_points,
  (select coalesce(points,0) from public.get_my_leaderboard_rank('topic',5,'mathematics','probability')) as actual_topic_points;
