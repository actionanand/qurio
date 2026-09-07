# Qurio SQL scripts

These scripts are read-only references intended for the Supabase Dashboard **SQL Editor**. They complement the versioned migrations and do not replace them. Do not copy migration or destructive files into this folder, because duplicate copies can drift and become unsafe.

## Folder responsibilities

- `supabase/migrations/`: schema, functions, grants, triggers, and RLS applied in numeric order.
- `supabase/scripts/`: reusable read-only inspection and verification queries.
- `supabase/manual/`: deliberate one-time or destructive operations that require review.

`003_qurio_learner_state.sql` therefore remains a migration. `bootstrap-owner.sql`, `reset-all-data.sql`, and `reset-learner-state.sql` remain manual scripts. This folder contains only inspection queries that are safe to run repeatedly.

## Recommended order

1. Run `00_database_inventory.sql` to see existing database objects.
2. Apply migrations `001`, `002`, `003`, and `004` in order if they are not already applied.
3. Run `06_post_migration_check.sql` and confirm that no expected objects are missing.
4. Register and verify the intended Owner account.
5. Replace `<OWNER_EMAIL>` in `supabase/manual/bootstrap-owner.sql` and run it once.
6. Use the account, learner-state, audit, and security scripts for diagnostics.

All numbered files in this folder use `select` queries and do not modify data. Scripts under `supabase/manual/` can modify or permanently remove data; open and review the complete file before choosing **Run**.

Queries containing placeholders such as `<USER_EMAIL>`, `<QUIZ_ID>`, or `<ATTEMPT_UUID>` require replacement before execution.

For a confirmation email that arrives but does not verify the user, run `08_email_verification_diagnosis.sql` and follow the local verification section in `docs/supabase-auth.md`.
