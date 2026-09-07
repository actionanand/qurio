# Start Here

## Recommended implementation order

Do not start by changing the Qurio UI. Set up the authentication infrastructure first.

### Phase 1 — Create Supabase

Create one Supabase project dedicated to Qurio.

#### New Project screen

Use the following values/recommendations:

- **Organization:** select the Supabase organization where Qurio should live.
- **GitHub connection:** skip it for now. Qurio does not need a GitHub connection to set up Auth or Postgres.
- **Project name:** `qurio`
- **Database password:** generate a strong password and store it in your password manager.
  - This password is for the Postgres database.
  - Qurio's Angular/Ionic client will **not** use this password directly.
  - Do not put it in Angular environment files or the GitHub repository.
- **Region:** choose the Asia-Pacific region closest to the expected users in India.

#### Security options

Use these settings on the Supabase **Create a new project** screen:

```text
☑ Enable Data API

☐ Automatically expose new tables

☑ Enable automatic RLS
```

Why:

1. **Enable Data API → ON**
   - Qurio will use `@supabase/supabase-js` from Angular/Ionic.
   - The Data API is needed for the client to access only the tables, views and RPC functions that we explicitly permit.

2. **Automatically expose new tables → OFF**
   - Keep this disabled.
   - Qurio will explicitly grant access only to database objects the client actually needs.
   - This reduces the risk of a newly created table becoming reachable before its grants and RLS policies are reviewed.

3. **Enable automatic RLS → ON**
   - Keep this enabled.
   - Qurio relies heavily on Row Level Security for profiles, study progress, quiz attempts, wrong-question data, exam-plan progress and admin access.
   - Grants decide whether an API role may access a database object at all; RLS decides which rows that caller may access.

Leave **Advanced Configuration** at its defaults unless a later Qurio requirement specifically needs a change.

After the project is created:

1. Keep Email/Password authentication enabled.
2. Enable **Confirm Email**.
3. Keep new user signup enabled.
4. Configure Qurio's production Site URL and local development redirect URLs.
5. Do not put any Supabase secret/service-role key in the Angular/Ionic app.

### Phase 2 — Create Resend

1. Create a Resend account.
2. Verify a domain you control.
3. Create a Resend API key.
4. Configure Resend as Supabase Auth's custom SMTP provider.
5. Set a sender such as `Qurio <no-reply@your-domain.com>`.
6. Send a test signup confirmation.

### Phase 3 — Create the Qurio DB model

Create:

- `profiles`
- `account_audit_log`
- `user_settings`
- `study_progress`
- `quiz_attempts`
- `quiz_attempt_answers`
- `exam_plan_task_progress`

Add triggers:

- create `profiles` row after Auth signup
- sync `auth.users.email_confirmed_at` to `profiles.email_verified_at`

Add management RPCs:

- approve
- deny
- suspend
- reactivate
- promote Admin
- demote Admin

The **approve RPC must reject an unverified account**.

### Phase 4 — Bootstrap the Owner

1. Sign up the Owner normally.
2. Verify the Owner email.
3. From Supabase SQL Editor, change that one profile to:
   - `role = owner`
   - `status = approved`
4. Never create another Owner.

### Phase 5 — Wire Qurio Auth UI

Add:

- Register
- Verification Sent
- Sign In
- Awaiting Approval
- Denied
- Suspended
- Sign Out

Registration collects:

- name
- email
- password
- confirm password (client-only validation)

### Phase 6 — Build Control Center

Admin/Owner screens:

- Pending
- Unverified
- Approved
- Suspended
- Denied

Owner-only screens:

- Admin management
- Audit history

### Phase 7 — Replace local learner persistence

After Auth works, migrate the existing local repository abstraction to Supabase:

- study progress
- quiz attempts
- wrong-question history
- settings
- exam-plan task state

## What to do today

Start with **Supabase project creation + Resend domain/SMTP setup**. Do not write Control Center UI until you can successfully:

1. register a test user,
2. receive the Resend verification email,
3. click the verification link,
4. see `email_verified_at` change in the public Qurio profile.
