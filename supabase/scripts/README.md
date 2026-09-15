# Qurio SQL scripts

These scripts are read-only references intended for the Supabase Dashboard **SQL Editor**. They complement the versioned migrations and do not replace them. Do not copy migration or destructive files into this folder, because duplicate copies can drift and become unsafe.

## Folder responsibilities

- `supabase/migrations/`: schema, functions, grants, triggers, and RLS applied in numeric order.
- `supabase/scripts/`: reusable read-only inspection and verification queries.
- `supabase/manual/`: deliberate one-time or destructive operations that require review.

`003_qurio_learner_state.sql` therefore remains a migration. `bootstrap-owner.sql`, `reset-all-data.sql`, and `reset-learner-state.sql` remain manual scripts. This folder contains only inspection queries that are safe to run repeatedly.

## Recommended order

1. Run `00_database_inventory.sql` and `12_migration_readiness.sql` to see existing database objects and the last complete migration stage.
2. Apply only missing migrations, strictly in the order `001`, `002`, `003`, `004`, `005`.
3. Re-run `12_migration_readiness.sql` after each migration. Every row for that migration and all earlier migrations must be true before continuing.
4. After `005`, run `06_post_migration_check.sql` and confirm that no expected objects are missing.
5. Register and verify the intended Owner account.
6. Replace `<OWNER_EMAIL>` in `supabase/manual/bootstrap-owner.sql` and run it once.
7. Use the account, learner-state, audit, and security scripts for diagnostics.

Numbered files are inspection queries. Script `11` also contains an explicitly marked bookmark write check inside a transaction that always rolls back. Scripts under `supabase/manual/` can modify or permanently remove data; open and review the complete file before choosing **Run**.

Queries containing placeholders such as `<USER_EMAIL>`, `<QUIZ_ID>`, or `<ATTEMPT_UUID>` require replacement before execution.

Scripts `09`, `10`, and `11` verify learning summaries, best-attempt leaderboards, category filters, and bookmark RLS after migration `005`.

The focused post-migration checks are:

- `001`: `01_account_overview.sql`, `02_pending_and_verification.sql`, and `05_security_review.sql`
- `002`: `01_account_overview.sql`, `05_security_review.sql`, and `07_audit_log_review.sql`
- `003`: `03_learner_state_overview.sql`, `04_quiz_attempt_details.sql`, and `05_security_review.sql`
- `004`: `07_audit_log_review.sql`
- `005`: `06_post_migration_check.sql`, `09_learning_summary.sql`, `10_leaderboard_check.sql`, and `11_bookmarks_check.sql`

Run `12_migration_readiness.sql` at every stage. It does not write schema or data.

`supabase/tests/005_leaderboard_formula.sql` is a non-mutating contract test for best-attempt scoring, retry resistance, category filtering, and sanitized leaderboard output metadata.

For a confirmation email that arrives but does not verify the user, run `08_email_verification_diagnosis.sql` and follow the local verification section in `docs/supabase-auth.md`.
