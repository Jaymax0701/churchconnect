-- ChurchConnect: member approval state and restricted one-time bootstrap audit.
-- DRAFT FOR STAGING REVIEW ONLY. Not applied to any database.
-- Never apply this draft to production without separate explicit approval.
-- This migration does not approve an account or assign the first superadmin.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.roles') IS NULL
     OR to_regclass('public.user_roles') IS NULL THEN
    RAISE EXCEPTION 'Required ChurchConnect authorization tables are missing; aborting.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = 'superadmin') THEN
    RAISE EXCEPTION 'Canonical role id superadmin is missing; aborting.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('is_approved', 'approved_at', 'approved_by')
  ) THEN
    RAISE EXCEPTION 'One or more approval columns already exist; reconcile schema before applying this draft.';
  END IF;

  IF to_regclass('public.security_bootstrap_audit') IS NOT NULL THEN
    RAISE EXCEPTION 'public.security_bootstrap_audit already exists; reconcile schema before applying this draft.';
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN is_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN approved_at timestamptz NULL,
  ADD COLUMN approved_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.is_approved IS
  'Account approval gate. New profile rows default to false; approval does not itself grant module permissions.';
COMMENT ON COLUMN public.profiles.approved_at IS
  'Timestamp when account approval was granted by the trusted administrative workflow.';
COMMENT ON COLUMN public.profiles.approved_by IS
  'Auth user who granted approval through the administrative workflow. NULL is permitted for the trusted initial bootstrap.';

CREATE TABLE public.security_bootstrap_audit (
  event_type text PRIMARY KEY
    CHECK (event_type = 'first_superadmin_bootstrap'),
  target_user_id uuid NOT NULL,
  operator_reference text NOT NULL CHECK (length(btrim(operator_reference)) > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.security_bootstrap_audit IS
  'Restricted one-time bootstrap record. The primary key on event_type permits only one first-superadmin bootstrap event.';

ALTER TABLE public.security_bootstrap_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.security_bootstrap_audit
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;

-- Expected: is_approved is NOT NULL with default false; metadata columns exist.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('is_approved', 'approved_at', 'approved_by')
ORDER BY ordinal_position;

-- Expected: one row, with RLS enabled.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'security_bootstrap_audit';
