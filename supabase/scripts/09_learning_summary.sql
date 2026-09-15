-- Replace <USER_EMAIL>, then compare source rows with the summary RPC while signed in as that user.
select p.email,
  count(distinct s.content_id) filter (where s.state='completed') as lessons_completed,
  count(distinct q.id) as quiz_attempts,
  count(distinct q.quiz_id) as unique_quizzes
from public.profiles p
left join public.study_progress s on s.user_id=p.id
left join public.quiz_attempts q on q.user_id=p.id
where lower(p.email)=lower('<USER_EMAIL>') group by p.email;

select * from public.get_my_learning_summary();
