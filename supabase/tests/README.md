# Qurio Supabase SQL tests

These SQL files are intended for the Supabase Dashboard SQL Editor after the corresponding migrations have been applied.

## Tests

- `005_leaderboard_formula.sql` — non-mutating contract test for best-attempt scoring, retry resistance, subject filtering, and sanitized leaderboard output metadata.
- `006_authenticated_learning_summary.sql` — simulates an approved authenticated user and exercises `get_my_learning_summary()`.
- `007_authenticated_leaderboard.sql` — simulates an approved authenticated user and exercises overall/grade/subject/topic leaderboard RPCs plus security-contract checks.
- `008_authenticated_bookmarks.sql` — simulates an approved authenticated user, verifies bookmark RLS, performs a temporary bookmark write/delete, and rolls the transaction back.

## Approved-user tests

Supabase SQL Editor does not normally carry the JWT/session of the Qurio user logged into the application. Tests `006`–`008` therefore set a transaction-local JWT claim and switch to the `authenticated` role.

Before running one of these files, replace:

`<APPROVED_USER_EMAIL>`

with the email of an existing `profiles.status = 'approved'` Qurio account.

Do not commit a real personal email into these reusable test files.

All approved-user tests use `BEGIN ... ROLLBACK`, so transaction-local auth context and temporary bookmark changes are discarded after the test.

Empty learner-summary/leaderboard results are valid before the selected user has recorded learning activity.
