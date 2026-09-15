# Qurio Supabase authentication and learner state

Qurio uses Supabase Auth for email/password identity and `public.profiles` for Qurio authorization. Email verification and administrator approval are separate gates. A newly registered account remains `role=user, status=pending` after its email is verified. Only an approved account can use learner routes and private learner tables.

For Dashboard navigation, table descriptions, ready-to-run inspection queries, account joins, learner-state queries, row counts, and RLS/grant checks, see [Viewing and querying Qurio data](supabase-query-guide.md).

## Browser configuration

The Angular environments contain only browser-safe values:

- `appUrl`: `http://localhost:3039` in development and the existing GitHub Pages URL in production
- `turnstile.siteKey`: the public Cloudflare Turnstile site key
- `supabaseUrl`
- `supabaseKey`: the publishable/anonymous client key

Never place a database password, service-role key, Supabase secret key, Turnstile secret, Resend API key, or SMTP password in Angular or this repository. Resend SMTP and email templates remain external Supabase Dashboard configuration. Localhost redirect support is temporary development configuration; it must not be part of the production Turnstile hostname allowlist.

## CAPTCHA protection

`environment.appUrl` is the single source for the hosted application, authentication redirects, and hosted CAPTCHA challenge. Its current production value is `https://actionanand.github.io/qurio`. The application derives:

- origin: `new URL(environment.appUrl).origin`, currently `https://actionanand.github.io`
- Turnstile hostname: `new URL(environment.appUrl).hostname`, currently `actionanand.github.io`
- deployed base path: `new URL(environment.appUrl).pathname`, currently `/qurio`
- hosted Android challenge: `${environment.appUrl}/auth/challenge`, currently `https://actionanand.github.io/qurio/auth/challenge`

Changing `environment.appUrl` updates these URLs without changing services or components. The production environment contains the configured public Turnstile site key; do not print, rotate, or duplicate it unnecessarily. Production configuration rejects a disabled or empty Turnstile setup. The Turnstile secret must never enter Angular, GitHub, or the Android package.

In **Cloudflare Dashboard**, create a managed Turnstile widget and allow only the hostname derived from `environment.appUrl`, currently `actionanand.github.io`. `/qurio` is a route path and is not part of the hostname. Do not permanently allow `localhost`, `127.0.0.1`, or `https://localhost` in the production widget.

In **Supabase Dashboard → Authentication → Bot and Abuse Protection**, enable CAPTCHA protection, select Cloudflare Turnstile, and enter the Turnstile secret key. Supabase validates every token server-side. The client origin/path check only improves user experience and is not the security boundary.

Hosted web login, signup, recovery-email requests, and verification-email resend render Turnstile directly and pass the short-lived token using the installed Supabase SDK's supported `captchaToken` option. The token is cleared and the widget reset after every operation. Tokens are never written to local storage, IndexedDB, URLs, Supabase tables, logs, or analytics.

The Capacitor Android login form keeps credentials inside the app. It embeds `${environment.appUrl}/auth/challenge`; Turnstile therefore executes under the hosted production hostname. The challenge page returns only a CAPTCHA token and random request ID. The parent requires the hosted origin, the exact iframe window, the expected message type, the matching request ID, and a non-empty token. The challenge page uses the exact Capacitor parent origin as the `postMessage` target. No wildcard target is used, and no email, password, access token, or refresh token crosses this channel. The Capacitor transport origin `https://localhost` is not a Turnstile hostname allowlist entry.

Development keeps `turnstile.enabled = false` in the non-production environment. Protected Auth submit buttons are disabled and Supabase Auth is never called without a CAPTCHA token. The application itself and existing authenticated sessions can still initialize. To test CAPTCHA locally, temporarily configure a development widget/hostname and enable the development setting. Do not weaken `environment.prod.ts` or the production Cloudflare widget.

The GitHub Pages workflow copies the built `index.html` to `404.html`. This preserves Angular routing when Android directly requests `${environment.appUrl}/auth/challenge`; GitHub Pages serves the SPA fallback and Angular resolves `/auth/challenge` under the `/qurio/` base href.

The production Cloudflare widget and Supabase CAPTCHA protection are already configured outside this repository. Supabase redirect allowlists are separate from Turnstile hostname allowlists: a temporary `http://localhost:3039/**` Auth redirect does not authorize localhost to render the production Turnstile widget.

## Apply the database source

The migrations are ordered and non-destructive:

1. `001_qurio_auth_foundation.sql` mirrors the foundation already applied live.
2. `002_qurio_admin_control.sql` adds secure account-management RPCs.
3. `003_qurio_learner_state.sql` adds approved-user settings, progress, attempts, answers, plan tasks, and wrong-question statistics.
4. `004_qurio_auto_approval.sql` adds the Owner-controlled automatic-approval policy and its audit trail.

Review the SQL, then apply it with the Supabase CLI linked to the correct project:

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
```

All client-facing objects have explicit grants as well as RLS. Status and role changes are only available through `SECURITY DEFINER` functions that validate the live caller profile. The three-Admin limit is locked and enforced in the database. Learner RLS calls `current_user_is_approved()`, which reads the live profile so suspension takes effect without waiting for JWT expiry.

## Bootstrap the first Owner

1. Register through `/auth/register` using the intended Owner email.
2. Open the confirmation email and verify it.
3. Open `supabase/manual/bootstrap-owner.sql`.
4. Replace `<OWNER_EMAIL>` with that exact email address.
5. Run the script once in the Supabase SQL Editor.
6. Sign out and back in, then open `/admin/users`.

The transaction fails if the email is unverified or an Owner already exists. It never promotes the first signup automatically and is not exposed as a browser RPC.

## Local email-verification setup

Before testing locally, open **Supabase Dashboard → Authentication → URL Configuration** and set:

```text
Site URL:      http://localhost:3039
Redirect URL:  http://localhost:3039/**
```

The Angular signup and resend calls use `http://localhost:3039/auth/callback`. Keep the development server running while opening the email link.

The recommended **Confirm signup** email template uses Supabase's complete hosted verification URL:

```html
<a href="{{ .ConfirmationURL }}">Confirm email address</a>
```

That link first reaches Supabase Auth, confirms the email, and then redirects to Qurio. Do not replace it with a link containing only `{{ .SiteURL }}` or `{{ .RedirectTo }}` because those values alone do not contain a verification token.

Qurio also accepts a custom token-hash link when needed:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirm email address</a>
```

`RedirectTo` already resolves to the full Qurio callback supplied during signup, so do not append `/auth/callback` again. After changing a template or URL setting, request a new verification email; an already-issued message keeps its original link.

If login returns `email_not_confirmed`, run `supabase/scripts/08_email_verification_diagnosis.sql` after replacing `<USER_EMAIL>`:

- `auth.users.email_confirmed_at` is null: Supabase has not accepted the email link. Check the received link, Auth logs, URL allowlist, template, and request a new message.
- Auth confirmation has a timestamp but `profiles.email_verified_at` is null: the Auth-to-profile update trigger is missing or failed. Apply/inspect migration `001_qurio_auth_foundation.sql`.
- Both timestamps exist and profile status is `pending`: verification succeeded. This is correct; an Owner/Admin must still approve the account.

The login page routes `email_not_confirmed` users to the verification page, where they can request a fresh link.

## Password recovery

Users can request a reset from `/auth/forgot-password` or their Settings page. Staff can send the same recovery email for a known account from the Admin Control Center. The client always shows a generic success message so the public recovery form does not reveal whether an email is registered.

Recovery redirects use `/auth/update-password?recovery=1`. The update page stays disabled until Supabase has consumed or explicitly exchanged the recovery credential and established the corresponding authenticated session. A code that remains in the URL is exchanged even when the browser already has another session, preventing that unrelated session from being used for the reset. After a successful password update, Qurio signs out and returns to the login page.

## Reset all accounts and user data

For a deliberate clean start, run `supabase/manual/reset-all-data.sql` in the Supabase SQL Editor. It deletes every `auth.users` row, which cascades to profiles and learner-state rows, and then clears the deliberately independent audit log. It preserves the database schema, migrations, functions, triggers, grants, and RLS policies. Verify that the final query returns zero Auth users and zero audit events before registering and bootstrapping a new Owner.

## Deploy Edge Functions

Hard deletion and staff-triggered verification resend use server-side credentials:

```bash
supabase functions deploy admin-delete-user
supabase functions deploy admin-resend-verification
supabase secrets set QURIO_APP_URL=http://localhost:3039
```

For production, change `QURIO_APP_URL` to the real Qurio production origin. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions; never copy the service-role key into Angular. The delete function snapshots the target and actor in `account_audit_log` before deleting the Auth user. Audit UUIDs intentionally have no live-user foreign keys, so the record survives cascade deletion.

## Account behavior

- Owner: manages users and Admins, sees the audit log, and cannot delete/demote itself in the normal UI.
- Owner can enable automatic approval. Enabling it approves existing verified pending users and automatically approves future users when email verification completes. Disabling it restores manual approval without revoking existing approvals.
- Admin: manages normal users, including unverified signups, but cannot alter Owner/Admin accounts.
- User: reads its own profile and, once approved, its own learner state.
- `pending`, `denied`, and `suspended` sessions are routed to their status page and rejected by learner RLS.
- Owner plus at most three Admin accounts is enforced by the database.

The browser preserves existing local settings and progress in `qurio.progress.v1`. For approved users, Supabase is the canonical source for completed lessons and Practice History. Complete device-only attempts are uploaded once by stable attempt ID; incomplete attempts created before answer synchronization remain in a separate device-only history and are never fabricated or uploaded. Per-user attempt sync state is stored in `qurio.progress.sync.v1`, and local completion ownership is stored in `qurio.progress.completions.v1`. These keys contain no Supabase token or secret. Learning Markdown, questions, answers, and explanations remain in the public content repository.

## End-to-end verification

1. Register a new email. Confirm `profiles` contains `role=user`, `status=pending`, and the audit log contains `signup`.
2. Confirm the email. Check `email_verified_at` is set, `status` is still `pending`, and `email_verified` was audited.
3. Sign in. Confirm Qurio routes redirect to `/auth/pending`.
4. As Owner, open `/admin/users`, select Pending, and approve the verified account. Approval of an unverified account must fail in both UI and RPC.
5. Refresh status or sign in again. Confirm the user reaches `/home` and can save study progress, a completed quiz attempt with answers, and exam-plan task progress.
6. Suspend the account and immediately confirm learner-table queries fail under RLS. Reactivate it and confirm access returns.
7. Verify Admin restrictions, Owner promotion/demotion, rejection of a fourth Admin, resend verification, and Owner-only `/admin/audit`.
8. Delete a normal test account. Confirm Auth/profile/learner rows are gone, its audit snapshot remains, and the deleted email can register again.
9. Test `/auth/forgot-password` through `/auth/update-password` without logging password values.

Use `npm run format:check`, `npm run lint`, `npm test -- --watch=false`, and `npm run build` for local validation. Database and Edge Function integration tests require the linked Supabase project and should use disposable test accounts.
