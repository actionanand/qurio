# Learner State Retention

## Migration principle

The current Qurio local repository abstraction is useful.

Keep interfaces such as:

```text
LearnerStateRepository
ExamPlanProgressRepository
```

Add Supabase-backed implementations rather than rewriting pages.

## Study state

Save logical ID:

```text
math-05-equivalent-fractions
```

not language-specific path.

Store:

```text
state
scroll_percent
last_opened_at
completed_at
language_last_used
```

Language is informational.

## Quiz state

Submit one attempt when the quiz ends.

Store:

```text
quiz_id
score
time
pass/fail
correct/wrong counts
```

Then save one answer record per question.

Do not write to Supabase after every option click unless you later need crash recovery.

## Wrong questions

Derive from `quiz_attempt_answers`.

Example:

```text
quiz_id: math-05-equivalent-fractions-02
question_id: q4

attempts: 5
wrong: 3
correct: 2
last result: wrong
```

Resolve current human-readable question text from GitHub content using `quiz_id + question_id`.

## Why not store question text?

Question content may improve over time and exists publicly in the content repo.

Supabase only needs the stable identity and learner result.

## Settings

Sync:

```text
preferred language
theme
selected curriculum
selected grade
selected exam plan
```

Local cache may still be kept for startup speed.

## Conflict strategy

Initially use simple last-write-wins for settings/study progress.

Quiz attempts are append-only.

Audit is append-only.

## Account deletion

Learner state should cascade-delete with the Auth account.

Audit history should remain.
