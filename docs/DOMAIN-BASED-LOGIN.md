# Domain-Based Login Protection

## Purpose

Qurio uses a public Supabase publishable key in the web and Android clients. This is expected: a browser or Android application cannot securely hide a client-side publishable key.

Because the publishable key can be copied, Qurio does **not** treat possession of the key as proof that a request came from the official app.

Instead, production authentication is protected with:

- **Cloudflare Turnstile** restricted to the official Qurio hostname.
- **Supabase Auth CAPTCHA protection**, which validates the Turnstile token server-side.
- Existing **Supabase authentication, account approval, RLS, grants, and protected RPCs**.
- A production application URL defined in one place: `environment.appUrl`.

The current production application URL is:

```text
https://actionanand.github.io/qurio
```

The goal is to avoid permanently allowing arbitrary websites or localhost to perform normal production login flows with only the copied Supabase publishable key.

> Important: this is domain-gated CAPTCHA protection, not a cryptographic proof that every API request originated from the website. Client-side `Origin`, `Referer`, hostname checks, or a hidden publishable key are not security boundaries. Supabase must continue to enforce RLS and authorization.

## Single Source of Truth

The deployed Qurio URL is stored in the Angular environment:

```ts
export const environment = {
  production: true,
  appUrl: 'https://actionanand.github.io/qurio',
  // ...
};
```

Do not hardcode the production URL repeatedly in services and components.

URLs should be derived from `environment.appUrl`, for example:

```ts
const appUrl = environment.appUrl;
const appOrigin = new URL(appUrl).origin;
const appHostname = new URL(appUrl).hostname;

const authCallbackUrl = `${appUrl}/auth/callback`;
const passwordRecoveryUrl = `${appUrl}/auth/update-password?recovery=1`;
const challengeUrl = `${appUrl}/auth/challenge`;
```

With the current configuration:

| Purpose                     | Value                                                      |
| --------------------------- | ---------------------------------------------------------- |
| App URL                     | `https://actionanand.github.io/qurio`                      |
| Browser origin              | `https://actionanand.github.io`                            |
| Turnstile hostname          | `actionanand.github.io`                                    |
| Hosted CAPTCHA page         | `https://actionanand.github.io/qurio/auth/challenge`       |
| Email verification callback | `https://actionanand.github.io/qurio/auth/callback`        |
| Password recovery page      | `https://actionanand.github.io/qurio/auth/update-password` |

The `/qurio` part is a **path**, not a hostname. Cloudflare Turnstile hostname configuration therefore uses `actionanand.github.io`, not `actionanand.github.io/qurio`.

## Production Login Flow

### Web

```text
https://actionanand.github.io/qurio
        |
        v
Cloudflare Turnstile
(hostname: actionanand.github.io)
        |
        v
short-lived CAPTCHA token
        |
        v
Supabase Auth
        |
        v
Supabase verifies CAPTCHA token server-side
        |
        v
authenticated session
        |
        v
approved profile + RLS + protected RPCs
```

Sign-in, sign-up, password-reset, and verification-resend requests pass a valid Turnstile token to Supabase Auth. The installed Supabase Auth SDK supports `captchaToken` on all four operations.

Turnstile tokens are treated as short-lived and single-use:

- do not store them in `localStorage`;
- do not store them in IndexedDB;
- do not write them to Supabase;
- clear/reset the token after every authentication attempt;
- request a new challenge after expiry or verification failure.

## Android Login

The Capacitor Android application internally uses a WebView origin similar to:

```text
https://localhost
```

That internal origin is **not** added to the production Turnstile hostname allowlist.

Instead, Android obtains the CAPTCHA challenge from the hosted Qurio page derived from `environment.appUrl`:

```text
https://actionanand.github.io/qurio/auth/challenge
```

Conceptually:

```text
Qurio Android
(Capacitor / https://localhost)
        |
        v
Hosted challenge page
https://actionanand.github.io/qurio/auth/challenge
        |
        v
Cloudflare Turnstile
        |
        v
CAPTCHA token
        |
        v
Qurio Android AuthService
        |
        v
Supabase Auth
```

The CAPTCHA token is returned to the Android app through a controlled `postMessage` handshake. The Android parent creates a cryptographically random request ID and sends an initialization message to the hosted iframe using the exact origin derived from `environment.appUrl`. The hosted page accepts initialization only from `environment.androidApp.webViewOrigin`. The result is accepted only from the hosted origin, matching iframe window, message type, and request ID. The listener and two-minute timeout are cleared after completion, reset, timeout, or destruction.

When using `postMessage`, Qurio must validate:

```ts
event.origin === new URL(environment.appUrl).origin;
```

Only the CAPTCHA token and minimal correlation information should cross this boundary.

Never send the following through `postMessage`:

- email;
- password;
- Supabase access token;
- Supabase refresh token;
- Turnstile secret key.

### Why localhost is not permanently allowed

Allowing `localhost` in the production Turnstile widget would weaken the hostname restriction because any local or Capacitor-hosted page could run the production widget.

Qurio therefore keeps the production widget restricted to the official hosted hostname and lets Android request the challenge from the official hosted Qurio page.

## Cloudflare Turnstile Configuration

Create a production Turnstile widget in Cloudflare.

### Production hostname

Add:

```text
actionanand.github.io
```

Do **not** enter:

```text
https://actionanand.github.io/qurio
https://actionanand.github.io
actionanand.github.io/qurio
localhost
127.0.0.1
https://localhost
```

Cloudflare hostname management accepts hostnames, not URL schemes, ports, or paths.

The public **site key** may be stored in the Angular environment:

```ts
turnstile: {
  enabled: true,
  siteKey: 'PUBLIC_TURNSTILE_SITE_KEY'
}
```

The Turnstile **secret key must never be added to Qurio source code or Angular environment files**.

## Supabase CAPTCHA Configuration

In the Supabase Dashboard:

1. Open the Qurio project.
2. Go to **Authentication**.
3. Open **Bot and Abuse Protection**.
4. Enable **CAPTCHA protection**.
5. Select **Cloudflare Turnstile**.
6. Enter the **Turnstile secret key**.
7. Save the configuration.

Supabase then validates the CAPTCHA token server-side for supported Auth operations.

The Angular application only receives the public Turnstile site key.

## Supabase Production URL Configuration

Open:

**Supabase Dashboard → Authentication → URL Configuration**

### Site URL

Set:

```text
https://actionanand.github.io/qurio
```

The Site URL is the default production redirect location used by Supabase Auth when an explicit redirect is not supplied.

### Production Redirect URLs

Keep exact production redirects such as:

```text
https://actionanand.github.io/qurio/auth/callback
https://actionanand.github.io/qurio/auth/update-password
```

Prefer exact production paths instead of a broad production wildcard.

Qurio code should derive these URLs from `environment.appUrl`.

For example:

```ts
emailRedirectTo: `${environment.appUrl}/auth/callback`;
```

and:

```ts
redirectTo: `${environment.appUrl}/auth/update-password?recovery=1`;
```

Email verification is allowed to complete in the browser. It does not need to reopen the Android application.

## Localhost Testing

Localhost is **not** part of the permanent production configuration.

The local development URL currently used by Qurio is:

```text
http://localhost:3039
```

When local browser authentication testing is required, temporarily add a localhost redirect in Supabase:

```text
http://localhost:3039/**
```

After testing, remove it again.

A more restrictive temporary setup can use only the required paths:

```text
http://localhost:3039/auth/callback
http://localhost:3039/auth/update-password
```

### Turnstile during local development

Do not permanently add `localhost` or `127.0.0.1` to the production Turnstile widget.

The checked-in development environment has Turnstile disabled and therefore fails protected Auth submissions closed. It displays the forms and a clear disabled message but does not call Supabase Auth without a CAPTCHA token. To test local authentication, explicitly enable the development setting and use one of these options:

- use Cloudflare Turnstile test keys for local development;
- use a separate development-only Turnstile widget; or
- temporarily configure local testing and remove it immediately afterward.

Production builds must keep the production widget restricted to the official Qurio hostname.

## Changing the Qurio Domain Later

If Qurio moves from:

```text
https://actionanand.github.io/qurio
```

to another deployment, for example:

```text
https://learn.example.com/qurio
```

perform all of the following changes.

### 1. Change Angular production environment

Update:

```ts
appUrl: 'https://learn.example.com/qurio';
```

Code should derive callback, recovery, challenge, origin, and hostname values from `environment.appUrl`.

### 2. Change Supabase Site URL

In:

**Supabase Dashboard → Authentication → URL Configuration**

replace:

```text
https://actionanand.github.io/qurio
```

with:

```text
https://learn.example.com/qurio
```

### 3. Replace Supabase Redirect URLs

Replace old production redirects:

```text
https://actionanand.github.io/qurio/auth/callback
https://actionanand.github.io/qurio/auth/update-password
```

with:

```text
https://learn.example.com/qurio/auth/callback
https://learn.example.com/qurio/auth/update-password
```

Remove obsolete production URLs after the new deployment is verified.

### 4. Update Cloudflare Turnstile Hostname

The hostname is derived from:

```ts
new URL(environment.appUrl).hostname;
```

For:

```text
https://learn.example.com/qurio
```

the hostname is:

```text
learn.example.com
```

Add the new hostname to the production Turnstile widget.

After the migration is complete, remove the old hostname if it is no longer used.

### 5. Verify deployment-specific Angular configuration

If the deployment path changes, verify Angular/GitHub Pages base-path configuration and routing as well.

Changing only Supabase settings is not sufficient when the application itself has moved to a new path or host.

## Changing Only the GitHub Pages Path

If the hostname stays:

```text
actionanand.github.io
```

but Qurio moves from `/qurio` to another path, Turnstile hostname configuration does not change.

For example:

```text
Old:
https://actionanand.github.io/qurio

New:
https://actionanand.github.io/learning
```

Turnstile still uses:

```text
actionanand.github.io
```

But the following must change:

- `environment.appUrl`;
- Supabase Site URL;
- Supabase redirect URLs;
- Angular deployment/base-path configuration.

## What the Supabase Publishable Key Does Not Protect

The following values are expected to be visible in the web/Android application:

```text
Supabase project URL
Supabase publishable key
Turnstile site key
```

These are client-side identifiers.

Never put these server-side secrets in Qurio:

```text
Supabase service_role key
Supabase sb_secret key
database password
Turnstile secret key
Resend API key
SMTP password
```

A copied publishable key must not give access to private Qurio data.

That protection comes from:

```text
Publishable key
        |
        v
Supabase Auth + CAPTCHA
        |
        v
authenticated JWT
        |
        v
verified / approved Qurio account
        |
        v
RLS + grants + protected RPCs
```

## Why We Do Not Rely on Origin or Referer

Checks such as:

```ts
window.location.origin === new URL(environment.appUrl).origin;
```

are useful as client-side defence-in-depth and to prevent accidental use from the wrong deployment.

They are **not** sufficient authentication security because a custom HTTP client can forge request headers and modified JavaScript can remove client-side checks.

Therefore Qurio relies on:

1. Turnstile hostname restrictions;
2. Supabase server-side CAPTCHA verification;
3. Supabase Auth;
4. Qurio account approval;
5. RLS;
6. explicit database grants;
7. protected RPCs.

## Production Checklist

Before a production release, verify:

- `environment.prod.ts` has the correct `appUrl`.
- Production Turnstile is enabled.
- Current Turnstile hostname is `actionanand.github.io`.
- `localhost` is not in the production Turnstile hostname list.
- Supabase CAPTCHA protection is enabled.
- Turnstile secret exists only in Supabase.
- Supabase Site URL is `https://actionanand.github.io/qurio`.
- Supabase redirect URLs use exact production callback/recovery paths.
- Temporary localhost redirect URLs have been removed.
- Production auth forms require a fresh CAPTCHA token.
- CAPTCHA tokens are not persisted.
- Android uses the hosted challenge URL derived from `environment.appUrl`.
- Android does not require production Turnstile access for `https://localhost`.
- RLS remains enabled for user-owned data.
- No `service_role`, `sb_secret`, Turnstile secret, Resend secret, or SMTP password exists in the client repository.

## Local Testing Checklist

When local auth testing is required:

1. Add the required localhost redirect URL to Supabase.
2. Use Turnstile test keys or a development-only Turnstile configuration.
3. Test login, registration, email verification, and password recovery.
4. Confirm Supabase CAPTCHA validation succeeds.
5. Remove temporary localhost production redirect entries when finished.
6. Confirm the production Turnstile widget still allows only the production hostname.

## Current Qurio Values

```text
Production appUrl:
https://actionanand.github.io/qurio

Production origin:
https://actionanand.github.io

Production Turnstile hostname:
actionanand.github.io

Hosted Turnstile challenge:
https://actionanand.github.io/qurio/auth/challenge

Email verification callback:
https://actionanand.github.io/qurio/auth/callback

Password recovery:
https://actionanand.github.io/qurio/auth/update-password

Temporary local development:
http://localhost:3039
```

## Official References

- Supabase CAPTCHA protection:
  https://supabase.com/docs/guides/auth/auth-captcha
- Supabase Auth redirect URLs:
  https://supabase.com/docs/guides/auth/redirect-urls
- Cloudflare Turnstile hostname management:
  https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/
- Cloudflare Turnstile testing:
  https://developers.cloudflare.com/turnstile/troubleshooting/testing/
