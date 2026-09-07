# Email Verification

## Requirement

Every Qurio signup must verify ownership of the email address before Admin/Owner can approve the account.

Registration form:

```text
Name
Email
Password
Confirm Password
```

Only `name`, `email`, and `password` are sent to Supabase. Confirm Password is client-side validation only.

## Signup call

Conceptual Supabase client call:

```ts
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      display_name: name,
    },
    emailRedirectTo: AUTH_REDIRECT_URL,
  },
});
```

With **Confirm Email** enabled:

- Supabase creates the Auth user.
- The database trigger creates `public.profiles`.
- No normal authenticated app session is expected at signup.
- Supabase sends a confirmation email using the configured SMTP provider.
- Qurio shows a "Verify your email" page.

## Public profile fields

The Qurio public profile should contain:

```text
id
email
display_name
role
status
email_verified_at
status_changed_by
status_changed_at
...
```

### Why mirror verification state?

`auth.users.email_confirmed_at` lives in the protected Auth schema.

The Admin Control Center should not need direct access to `auth.users`.

Use a DB trigger to mirror:

```text
auth.users.email_confirmed_at
            ->
public.profiles.email_verified_at
```

That lets Admin/Owner query:

```text
Pending + Unverified
Pending + Verified
```

using normal RLS-protected public tables.

## Verification-sync trigger

Conceptually:

```sql
create or replace function public.sync_email_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    email_verified_at = new.email_confirmed_at,
    updated_at = now()
  where id = new.id;

  return new;
end;
$$;
```

Trigger it after changes to `auth.users.email_confirmed_at`.

## Approval enforcement

Do not rely only on a disabled Approve button.

The database approval RPC must check:

```sql
if target.email_verified_at is null then
  raise exception 'Email verification is required before approval';
end if;
```

This prevents DevTools/manual API calls from approving an unverified user.

## Self-service resend

On the Qurio "Verification Sent" page, let the registrant request another confirmation email:

```ts
await supabase.auth.resend({
  type: 'signup',
  email,
  options: {
    emailRedirectTo: AUTH_REDIRECT_URL,
  },
});
```

Add a UI cooldown to reduce accidental spam.

## Admin/Owner resend

Admin and Owner should see:

```text
Unverified

Anand
anand@example.com

[ Resend verification ]
[ Deny ]
[ Delete ]
```

Do not call Admin resend logic directly from an arbitrary public button.

Recommended flow:

```text
Control Center
      |
      v
admin-resend-verification Edge Function
      |
      +-- verify caller is approved Admin/Owner
      +-- verify target exists
      +-- verify target email is still unverified
      +-- call Supabase Auth resend(signup)
      +-- write account audit record
```

The resend still goes through Supabase Auth and therefore through Resend SMTP.

## Important distinction

Supabase Confirm Email prevents an unverified email/password user from normal sign-in.

After email verification, a `pending` user is verified but still not authorized for Qurio.

Qurio must then enforce:

```text
Authentication = Supabase knows who you are
Authorization  = Qurio profile says whether you may use the app
```

Use route guards plus RLS. A verified-but-pending user must only see the Awaiting Approval screen and their own minimal profile state.
