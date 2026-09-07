# Security and RLS

## Principle

Qurio is a public client.

Assume users can:

- inspect JavaScript
- call Supabase REST/RPC manually
- modify local state
- bypass Angular guards

Therefore permissions must live in Postgres RLS/RPCs.

## Profile reads

Normal user:

```text
read own profile only
```

Approved Admin/Owner:

```text
read all profiles
```

Owner:

```text
read audit log
```

## Learner tables

Require:

```text
row.user_id = auth.uid()
AND current profile.status = approved
```

Apply to:

- user_settings
- study_progress
- quiz_attempts
- quiz_attempt_answers
- exam_plan_task_progress

## Admin mutations

Do not grant unrestricted client UPDATE on `profiles`.

Use RPC functions:

```text
approve_user
deny_user
suspend_user
unsuspend_user
promote_admin
demote_admin
```

Each function re-checks:

- caller role
- caller status
- target role
- target status
- email verification when approving
- maximum Admin count
- Owner protection

## Unverified users

With Supabase Confirm Email enabled, unverified email/password users cannot normally sign in.

Their public profile still exists because it is created by an Auth database trigger.

This is how Admin/Owner can see unverified signups without letting those users into Qurio.

## Verified but Pending

After verification, authentication and authorization are separate.

The application must not expose learning data until status is approved.

RLS prevents that even if the user obtains an Auth session.

This is safer than relying on a client route guard.

## Secrets

Never place these in the Qurio client:

```text
Supabase secret/service-role key
Resend API key
SMTP password
```

Privileged operations use Supabase Edge Functions.
