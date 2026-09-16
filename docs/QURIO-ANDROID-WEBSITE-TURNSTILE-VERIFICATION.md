# Qurio Android ↔ Website Turnstile Verification

Qurio Android runs its packaged Angular application at `https://localhost`. The production Cloudflare Turnstile widget permits `actionanand.github.io`, so Android embeds this route from the deployed Qurio website:

```text
https://actionanand.github.io/qurio/auth/challenge
```

Turnstile therefore runs in the security context of the approved production hostname. The production widget does not need a permanent `localhost` hostname entry.

## Request flow

1. `AuthCaptchaComponent` creates a fresh ID with `crypto.randomUUID()` for every challenge.
2. It includes the ID in both the query string and URL fragment of the hosted challenge URL. The duplicate transport makes the ID survive Android WebView and GitHub Pages routing without using a cross-origin initialization message.
3. `ChallengePage` validates that it is running under `environment.appUrl`, that it is embedded in a parent frame, and that the request ID is a valid UUID v4.
4. The hosted page renders Turnstile directly.
5. After completion, the hosted page returns only `{ type, requestId, captchaToken }` to the fixed `environment.androidApp.webViewOrigin` target.
6. Android accepts the result only when all of these match:
   - the event origin is the origin derived from `environment.appUrl`;
   - the event source is the exact challenge iframe window;
   - the result request ID equals the active request ID;
   - the CAPTCHA token is non-empty.
7. The login, registration, resend-verification, or forgot-password flow sends its credentials and CAPTCHA token directly to Supabase Auth.

The hosted page never receives an email address, password, Supabase session, PIN, or biometric material.

## Lifecycle protection

The Android parent installs one result listener per challenge and starts a two-minute timeout. The listener and timer are removed after success, timeout, reset, or component destruction. Starting a new challenge first clears the previous listener and timeout. A consumed or expired CAPTCHA token is cleared and cannot be reused.

## Production values

```text
Android WebView origin: https://localhost
Official Qurio app URL: https://actionanand.github.io/qurio
Hosted challenge:       https://actionanand.github.io/qurio/auth/challenge
Turnstile hostname:     actionanand.github.io
Android package:        com.actionanand.qurio.app
```

These values come from the production environment. The hosted URL is derived from `environment.appUrl`; it is not duplicated in the authentication components.

## Deployment requirement

The hosted challenge is application code served by GitHub Pages. A CAPTCHA protocol change must therefore be deployed in both places:

1. push the change to `main-android`; `.github/workflows/gh-pages.yml` now publishes the matching hosted challenge from the same commit while the Android workflow builds the APK;
2. install the resulting APK after both workflows complete.

The Pages workflow also continues to support direct web releases from `main-github`.

Installing only the APK while GitHub Pages still serves an older challenge implementation can leave the iframe waiting on an incompatible protocol.

## Local browser testing

The normal development environment keeps Turnstile disabled and fails closed for protected authentication. For a temporary real browser test, add `localhost` to the Cloudflare widget, enable Turnstile locally, run the application, and remove the hostname again afterward. This local test path is separate from the production Android hosted-frame flow.

## Security boundary

The public Turnstile site key may be present in frontend configuration. The Turnstile secret stays in Supabase configuration and must never be bundled into the Angular or Android application. Supabase performs the server-side CAPTCHA validation.

This design verifies a CAPTCHA under the production website hostname. It is not APK attestation; Google Play Integrity would be a separate feature.
