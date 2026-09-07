# Resend SMTP Setup

## Why Resend

Supabase Auth generates the confirmation/recovery emails. Resend acts as the SMTP delivery provider.

This keeps the flow simple:

```text
Qurio signUp()
    ->
Supabase Auth
    ->
Supabase email template + confirmation token
    ->
Resend SMTP
    ->
User inbox
```

## Production prerequisite

For production sending, use a domain you control and verify it in Resend.

Example sender:

```text
Qurio <no-reply@auth.yourdomain.com>
```

Using an auth subdomain such as `auth.example.com` is a clean option.

## Resend SMTP credentials

Use:

```text
Host:      smtp.resend.com
Port:      465
Username:  resend
Password:  <Resend API key>
Security:  SSL/TLS
```

## Configure in Supabase

Supabase Dashboard:

```text
Authentication
  -> Email
  -> SMTP Settings
```

Set:

```text
Enable custom SMTP: ON
Sender name: Qurio
Sender email: no-reply@your-verified-domain
Host: smtp.resend.com
Port: 465
Username: resend
Password: Resend API key
```

Save.

## Email templates

Customize Supabase Auth templates rather than generating your own confirmation token.

Recommended confirmation email content:

```text
Subject:
Verify your Qurio email

Body:
Hi,

Thanks for creating a Qurio account.

Verify your email to continue your registration.

[ Verify email ]

After verification, your account will remain pending until a Qurio administrator approves it.

If you did not create this account, ignore this email.
```

## Redirect URLs

Configure Supabase URL settings for every environment you actually use.

Examples:

```text
Production:
https://<github-pages-host>/<qurio-path>/

Development:
http://localhost:<your-port>/
```

For the first implementation, it is simplest for the confirmation link to return to Qurio's web URL and show:

```text
Email verified successfully.
Your account is awaiting administrator approval.
```

Add Android deep links later when the Capacitor flow is ready.

## Rate limits

Both self-service and Admin-triggered resend requests are still Supabase Auth email requests and are subject to Auth/email rate limits.

Recommended client behavior:

- disable Resend button for 60 seconds after success
- display a neutral success message
- do not create repeated automatic resend loops
