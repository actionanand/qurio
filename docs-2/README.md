# Qurio Authentication & State Documentation

This folder defines the planned Supabase + Resend architecture for Qurio.

The recommended Supabase project-creation settings—including project name, database-password handling, region, Data API, automatic table exposure and automatic RLS—are documented in `00-START-HERE.md`.

## Core rules

- Learning content remains public/static in `qurio-learning-content`.
- Private learner state lives in Supabase.
- Authentication uses Supabase Email + Password.
- Email verification is required.
- A newly registered account is always `pending`.
- Admin/Owner can see unverified registrations.
- Only an email-verified `pending` account can be approved.
- Ignoring a registration means leaving it `pending`.
- Denied/suspended accounts remain registered and cannot sign up again with the same email.
- Only hard deletion of the Supabase Auth user makes that email eligible to register again.
- Exactly one Owner exists.
- Owner + at most three Admin accounts.
- Owner alone can promote/demote Admins.
- Admins can manage normal users; Owner can manage Admins and normal users.
- Owner can view full account-control audit history.

## Documents

1. `00-START-HERE.md`
2. `01-SYSTEM-ARCHITECTURE.md`
3. `02-ACCOUNT-LIFECYCLE.md`
4. `03-EMAIL-VERIFICATION.md`
5. `04-RESEND-SMTP.md`
6. `05-DATABASE-DESIGN.md`
7. `06-ROLES-ADMIN-OWNER.md`
8. `07-ADMIN-CONTROL-CENTER.md`
9. `08-CLIENT-AUTH-INTEGRATION.md`
10. `09-LEARNER-STATE.md`
11. `10-SECURITY-RLS.md`
12. `11-EDGE-FUNCTIONS.md`
13. `12-TESTING-CHECKLIST.md`
14. `13-DEPLOYMENT-CHECKLIST.md`
