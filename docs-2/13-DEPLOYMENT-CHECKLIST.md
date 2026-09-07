# Deployment Checklist

## Supabase

- [ ] Production Supabase project created with project name `qurio`.
- [ ] Database password generated and stored securely outside the client/repository.
- [ ] Asia-Pacific region selected close to the expected users in India.
- [ ] GitHub connection skipped unless it is intentionally introduced later.
- [ ] **Enable Data API** is ON.
- [ ] **Automatically expose new tables** is OFF.
- [ ] **Enable automatic RLS** is ON.
- [ ] Email/Password enabled.
- [ ] Confirm Email enabled.
- [ ] Site URL configured.
- [ ] GitHub Pages redirect URL configured.
- [ ] Local development redirect URL configured.
- [ ] RLS enabled on every private public-schema table.
- [ ] Owner bootstrapped.
- [ ] Three-Admin maximum enforced in database.
- [ ] Approval requires `email_verified_at`.
- [ ] Edge Functions deployed.

## Resend

- [ ] Domain verified.
- [ ] API key created.
- [ ] Supabase custom SMTP enabled.
- [ ] Sender address uses verified domain.
- [ ] Confirmation email tested.
- [ ] Password reset email tested.
- [ ] Bounce/delivery dashboard checked.

## Qurio client

- [ ] Only publishable Supabase key shipped.
- [ ] No secret keys in Git history.
- [ ] Register page translated EN/TA/HI.
- [ ] Verification Sent page translated.
- [ ] Pending/Denied/Suspended pages translated.
- [ ] Control Center protected.
- [ ] Owner-only routes protected.
- [ ] RLS tested manually, not just UI guards.
- [ ] Logout clears private in-memory state.
- [ ] Existing local progress migration strategy tested.

## GitHub Pages

- [ ] Auth redirect returns to deployed Qurio path correctly.
- [ ] SPA/hash routing works after confirmation redirect.
- [ ] HTTPS used.
