-- MANUAL REVIEW ONLY. Never run this file automatically against a remote project.
-- Apply only after supabase/manual/admin-crud.sql is present in the target database.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'carriers'
      AND policyname = 'admin_update' AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'Expected carriers admin_update policy is missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'carriers' AND column_name = 'active'
  ) THEN
    RAISE EXCEPTION 'carriers.active already exists; review the deployed schema before applying';
  END IF;
END $$;

-- The constant default makes every existing carrier active and makes new carriers
-- active unless an authorized admin explicitly deactivates them.
ALTER TABLE public.carriers
  ADD COLUMN active boolean NOT NULL DEFAULT true;

-- Existing table grants and policies apply to the new column. In particular:
-- anon/authenticated retain SELECT, while only the existing super-admin
-- admin_update policy can authorize browser UPDATEs.
COMMIT;
