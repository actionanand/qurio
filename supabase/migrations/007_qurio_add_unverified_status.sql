-- 007_qurio_add_unverified_status.sql
-- Adds a real database status for accounts that have not yet verified email.
--
-- IMPORTANT:
-- Run this migration by itself and let it COMMIT before running 008.
-- Migration 008 uses the new enum value.

alter type public.account_status
  add value if not exists 'unverified' before 'pending';
