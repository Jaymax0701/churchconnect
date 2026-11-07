-- ChurchConnect account foundation
-- REVIEW ONLY. Not an automatic migration. Do not execute until the owner
-- has reviewed this complete file and explicitly approved the target database.
--
-- Scope:
--   1. Add account approval metadata to public.profiles.
--   2. Create a profile automatically for each newly registered Auth user.
--   3. Default every new profile to unapproved.
--   4. Permit authenticated users to read their own profile and update only
--      their own full_name.
--
-- Deliberately excluded:
--   * Role assignment, permission seeding, and first-superadmin bootstrap.
--   * Broad privilege/default-ACL hardening (trusted consumers are not yet
--     fully inventoried).
--   * Changes to ministries, roles, modules, or legacy permission tables.
--   * Any production or non-production project identifiers.
--
-- Expected starting state from the reviewed database inventory:
--   * public.profiles exists with id and full_name columns.
--   * RLS is already enabled on public.profiles.
--   * auth.users and public.profiles contain no rows.
--   * Approval columns, this trigger function/trigger, and these policies
--     do not already exist.
--
-- The preflight below aborts if these assumptions are no longer true.
-- Run only as the trusted postgres database role in a separately approved
-- maintenance window. This script does not create or promote an administrator.

BEGIN;

DO $preflight$
DECLARE
  v_rls_enabled boolean;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run this reviewed operation as the trusted postgres database role.';
  END IF;

  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Required Auth/profile tables are missing; aborting.';
  END IF;

  SELECT c.relrowsecurity
    INTO v_rls_enabled
  FROM pg_class c
  WHERE c.oid = 'public.profiles'::regclass;

  IF v_rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RLS must already be enabled on public.profiles; aborting.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'full_name'
  ) THEN
    RAISE EXCEPTION 'Expected public.profiles.id and full_name columns; aborting.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('is_approved', 'approved_at', 'approved_by')
  ) THEN
    RAISE EXCEPTION 'Approval columns already exist or are partially deployed; reconcile before proceeding.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users)
     OR EXISTS (SELECT 1 FROM public.profiles) THEN
    RAISE EXCEPTION 'Auth/profile tables are no longer empty; prepare a reviewed backfill plan instead of applying this empty-database draft.';
  END IF;

  IF to_regprocedure('public.handle_new_auth_user_profile()') IS NOT NULL THEN
    RAISE EXCEPTION 'Profile trigger function already exists; inspect it before proceeding.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgrelid = 'auth.users'::regclass
      AND t.tgname = 'on_auth_user_created_profile'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Profile creation trigger already exists; inspect it before proceeding.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname IN ('profiles_select_own', 'profiles_update_own_name')
  ) THEN
    RAISE EXCEPTION 'One or more account profile policies already exist; reconcile before proceeding.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'Expected Supabase API roles are missing; aborting.';
  END IF;
END;
$preflight$;

-- Existing accounts are intentionally not backfilled by this draft.
-- The preflight requires both Auth and profile tables to be empty.
ALTER TABLE public.profiles
  ADD COLUMN is_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN approved_at timestamptz NULL,
  ADD COLUMN approved_by uuid NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.is_approved IS
  'Account approval gate. New profiles default to false. Approval does not grant module permissions.';
COMMENT ON COLUMN public.profiles.approved_at IS
  'Timestamp when a trusted administrative workflow approved the account.';
COMMENT ON COLUMN public.profiles.approved_by IS
  'Auth user who approved the account. NULL is permitted for a separately audited initial bootstrap.';

-- Auth metadata supplies display information only; it never grants approval
-- or a role. SECURITY DEFINER lets the trigger insert a profile without
-- granting clients direct INSERT privileges on public.profiles.
CREATE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $profile_fn$
BEGIN
  INSERT INTO public.profiles (id, full_name, is_approved)
  VALUES (
    NEW.id,
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$profile_fn$;

-- Trigger functions are invoked by the trigger; clients must not call them.
REVOKE ALL PRIVILEGES
  ON FUNCTION public.handle_new_auth_user_profile()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user_profile();

-- Remove the previously audited broad direct grants on this one table for
-- client-facing roles, then add only the privileges required for own-profile
-- viewing and display-name editing. service_role is deliberately untouched.
REVOKE ALL PRIVILEGES ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name) ON TABLE public.profiles TO authenticated;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own_name
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND id = (SELECT auth.uid()));

COMMIT;

-- ---------------------------------------------------------------------------
-- POST-DEPLOYMENT CATALOG CHECKS
-- These queries are read-only. Expected results are described inline.
-- ---------------------------------------------------------------------------

-- Expected: is_approved is NOT NULL with default false; the other two columns
-- exist and are nullable.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('is_approved', 'approved_at', 'approved_by')
ORDER BY column_name;

-- Expected: one enabled, non-internal trigger on auth.users.
SELECT t.tgname AS trigger_name, t.tgenabled AS trigger_enabled
FROM pg_trigger t
WHERE t.tgrelid = 'auth.users'::regclass
  AND t.tgname = 'on_auth_user_created_profile'
  AND NOT t.tgisinternal;

-- Expected: exactly the two policies created above.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;

-- Expected:
--   anon_selects_profiles = false
--   authenticated_selects_profiles = true
--   authenticated_updates_full_name = true
--   authenticated_updates_approval = false
--   authenticated_table_level_update = false
--   service_role_selects_profiles = true (preserved, not modified here)
SELECT
  has_table_privilege('anon', 'public.profiles', 'SELECT')
    AS anon_selects_profiles,
  has_table_privilege('authenticated', 'public.profiles', 'SELECT')
    AS authenticated_selects_profiles,
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
    AS authenticated_updates_full_name,
  has_column_privilege('authenticated', 'public.profiles', 'is_approved', 'UPDATE')
    AS authenticated_updates_approval,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
    AS authenticated_table_level_update,
  has_table_privilege('service_role', 'public.profiles', 'SELECT')
    AS service_role_selects_profiles;

-- ---------------------------------------------------------------------------
-- REQUIRED BEHAVIORAL TESTS BEFORE OPENING PUBLIC REGISTRATION
-- Use disposable test accounts and real Supabase Auth sessions:
--   1. Sign up with full_name metadata; verify exactly one profile is created.
--   2. Verify the new profile has is_approved = false and no user_roles row.
--   3. The user can read only their own profile.
--   4. The user can update full_name on their own profile.
--   5. Attempts to update is_approved, approved_at, approved_by, or id fail.
--   6. Attempts to read another user's profile fail or return no rows.
--   7. anon cannot read profiles.
--   8. A failed profile-trigger insert causes Auth user creation to fail
--      transactionally; investigate trigger errors before enabling signup.
--
-- ROLLBACK NOTE:
-- Do not run an automatic rollback that drops approval columns after accounts
-- have registered or approval data exists. A rollback must be separately
-- reviewed, must account for the exact grants/policies in place beforehand,
-- and must preserve any account data. No broad original grants are restored
-- by this file.
-- ---------------------------------------------------------------------------
