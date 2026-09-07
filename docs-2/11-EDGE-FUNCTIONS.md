# Edge Functions

Two Edge Functions are recommended.

## 1. `admin-resend-verification`

Purpose:

Allow an approved Admin/Owner to resend the Supabase signup confirmation email to an unverified target account.

Flow:

```text
Qurio Control Center
       |
       v
Edge Function
       |
       +-- verify caller JWT
       +-- read caller profile
       +-- require approved Admin/Owner
       +-- read target profile
       +-- require email_verified_at IS NULL
       +-- normally require status = pending
       +-- call Supabase Auth resend(type='signup')
       +-- write audit action 'resend_verification'
       v
Resend SMTP sends email
```

Do not expose the Resend API key in the app.

For this function, the resend call should use Supabase Auth so the normal Supabase verification token/template is used.

## 2. `admin-delete-user`

Purpose:

Hard-delete a Supabase Auth account.

Why Edge Function?

The browser-safe key cannot use privileged Auth Admin deletion safely.

Flow:

```text
Control Center
     |
     v
Edge Function
     |
     +-- verify caller JWT
     +-- verify role
     +-- protect Owner
     +-- Admin can delete normal users only
     +-- Owner may delete Admin/normal user
     +-- snapshot target/actor in audit
     +-- Auth admin delete user
     v
profile + learner state cascade delete
```

## Self resend does not need Admin function

A user who just registered can resend their own signup confirmation from the Verification Sent page using Supabase's public Auth resend method.

Admin-triggered resend should use the Edge Function so:

- authorization is enforced
- actor is known
- audit is recorded
- abuse is easier to control
