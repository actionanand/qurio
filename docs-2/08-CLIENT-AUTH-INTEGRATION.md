# Qurio Client Auth Integration

## Package

```bash
npm i @supabase/supabase-js
```

## Environment

Keep only browser-safe values:

```ts
supabaseUrl;
supabasePublishableKey;
```

Never ship:

```text
service_role key
secret key
Resend API key
SMTP password
```

## Suggested client structure

```text
src/app/core/auth/
  auth.service.ts
  auth.state.ts
  auth.guard.ts
  approved.guard.ts
  admin.guard.ts
  owner.guard.ts
  auth.models.ts

src/app/core/supabase/
  supabase.client.ts

src/app/features/auth/
  sign-in/
  register/
  verification-sent/
  awaiting-approval/
  denied/
  suspended/

src/app/features/control-center/
  dashboard/
  users/
  admins/
  audit/
```

## Auth state

Suggested Signals:

```text
session
user
profile
loading

isAuthenticated
isEmailVerified
isApproved
isAdmin
isOwner
```

Do not treat JWT claims as the only source of live account status.

Fetch the current profile because suspension/denial can change after a token was issued.

## Signup

1. Validate name.
2. Validate email.
3. Validate password.
4. Match confirm password.
5. `supabase.auth.signUp()`.
6. Show Verification Sent page.

Do not attempt to create `profiles` from Angular. The DB trigger owns that.

## Sign in

```text
Email + Password
      |
      v
Supabase Auth
      |
      v
Load profile
```

Then:

```text
approved  -> App
pending   -> Awaiting Approval
denied    -> Denied screen + no learner data
suspended -> Suspended screen + no learner data
```

## Verification callback

After confirmation:

1. Supabase marks email confirmed.
2. verification-sync trigger updates public profile.
3. Qurio shows:
   - Email verified
   - Awaiting Admin approval

## Important security point

A route guard is UX.

Database RLS is the actual authorization boundary.

Every private learner table must require:

```text
auth.uid() = row.user_id
AND profile.status = approved
```

Admin reads/actions must require live approved Admin/Owner role.
