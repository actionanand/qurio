# System Architecture

```text
                           Qurio
                     Ionic + Angular
                            |
             +--------------+--------------+
             |                             |
             v                             v
  qurio-learning-content                Supabase
          GitHub                           |
             |                  +----------+-----------+
   +---------+---------+        |          |           |
   |         |         |        v          v           v
 Notes    Quizzes   Exam Plans  Auth     Postgres   Edge Functions
                                  |          |           |
                                  |          |           +-- admin resend verification
                                  |          |           +-- hard-delete user
                                  |          |
                                  |          +-- profiles
                                  |          +-- audit
                                  |          +-- study state
                                  |          +-- quiz history
                                  |          +-- wrong answers
                                  |          +-- exam-plan state
                                  |
                                  +-- Email + Password
                                  +-- Email confirmation
                                  +-- Resend SMTP
```

## Responsibility boundary

### GitHub content repo

Contains only public learning data:

- Manifest
- Subject notes
- Syllabus
- Quiz JSON
- Exam definitions
- Exam plans
- Daily plans

Never store learner PII or progress in GitHub.

### Supabase

Stores private state:

- users
- roles
- approval status
- verification state mirror
- admin actions/audit
- learning progress
- quiz attempts
- wrong answers
- preferences
- exam-plan progress

### Resend

Resend is only the email delivery provider.

Supabase Auth still owns:

- signup
- confirmation token generation
- verification links
- password recovery
- auth email templates

Resend delivers those Supabase-generated emails through SMTP.

## State identities

Continue using stable Qurio content IDs.

Example:

```text
Study:
math-05-equivalent-fractions

Quiz:
math-05-equivalent-fractions-02

Question:
q3

Option:
B
```

Do not copy entire Markdown or quiz JSON into Supabase.
