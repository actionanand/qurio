# Database Design

## `profiles`

Application-level user identity and authorization.

Recommended columns:

```text
id uuid PK -> auth.users.id
email text
display_name text

role
  owner | admin | user

status
  pending | approved | denied | suspended

email_verified_at timestamptz nullable

status_reason text nullable
status_changed_by uuid nullable
status_changed_at timestamptz nullable

role_changed_by uuid nullable
role_changed_at timestamptz nullable

created_at
updated_at
```

Rules:

- one Owner maximum
- three Admins maximum, Owner not counted in the three
- new Auth user => pending/user
- approval requires `email_verified_at IS NOT NULL`

## `account_audit_log`

Historical account-control actions.

Recommended actions:

```text
signup
email_verified
resend_verification
approve
deny
suspend
unsuspend
promote_admin
demote_admin
delete_user
owner_bootstrap
```

Store snapshots:

```text
target_user_id
target_email
target_display_name

actor_user_id
actor_email
actor_role

previous_status
new_status
previous_role
new_role
reason
created_at
```

Do not require audit user IDs to have foreign keys to live Auth users. Otherwise hard deletion would destroy or invalidate history.

Only Owner needs full audit-log read permission.

## `user_settings`

```text
user_id PK
preferred_language
theme
selected_curriculum
selected_grade
selected_exam_plan_id
updated_at
```

## `study_progress`

One row per user + logical content ID.

```text
user_id
content_id
state
scroll_percent
language_last_used
first_opened_at
last_opened_at
completed_at
updated_at
```

Primary key:

```text
(user_id, content_id)
```

## `quiz_attempts`

One row per completed attempt.

```text
id
user_id
quiz_id
series_id
language_used

quiz_version
content_version

started_at
completed_at
time_taken_seconds
auto_submitted

total_questions
correct_count
wrong_count
unanswered_count
score_percent
passing_percentage
passed
```

## `quiz_attempt_answers`

One row per question answered in an attempt.

```text
attempt_id
user_id
quiz_id
question_id
selected_option_id
correct_option_id
is_correct
hint_used
time_spent_seconds
answered_at
```

This supports wrong-question analysis without duplicating question text.

## `exam_plan_task_progress`

Plan-only completion.

```text
user_id
plan_id
plan_date
task_key
task_type
completed
completed_at
updated_at
```

Do not duplicate linked note/quiz completion here.

Linked learning state already belongs in:

```text
study_progress
quiz_attempts
```
