-- Catalog-level verification for the 0004 authorization foundation draft.
-- Run only after the draft has been reviewed and deliberately applied to staging.
-- This does not replace behavioral tests using real authenticated test accounts.

DO $test$
DECLARE
  v_count integer;
  v_security_definer boolean;
BEGIN
  IF to_regclass('public.role_module_permissions') IS NULL
     OR to_regclass('public.user_module_permissions') IS NULL THEN
    RAISE EXCEPTION 'FAIL: proposed permission tables are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ministries'
      AND column_name = 'leader_id' AND data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'FAIL: ministries.leader_id uuid is missing';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'ministries', 'modules', 'permissions', 'profiles', 'role_permissions',
      'roles', 'user_roles', 'role_module_permissions',
      'user_module_permissions', 'security_bootstrap_audit'
    )
    AND c.relrowsecurity;

  IF v_count <> 10 THEN
    RAISE EXCEPTION 'FAIL: expected RLS enabled on 10 tables; found %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_own'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'FAIL: own-profile SELECT policy missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_update_own_name'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'FAIL: own-profile name UPDATE policy missing';
  END IF;

  IF has_table_privilege('anon', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon unexpectedly has SELECT on profiles';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated lacks SELECT grant required by own-profile policy';
  END IF;

  IF has_column_privilege('authenticated', 'public.profiles', 'is_approved', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can update profiles.is_approved';
  END IF;

  IF has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.user_roles', 'DELETE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can directly mutate user_roles';
  END IF;

  SELECT prosecdef INTO v_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'guard_profile_approval_fields';

  IF v_security_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: approval guard must run as invoker so it can inspect caller role';
  END IF;

  SELECT prosecdef INTO v_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'guard_user_role_mutations';

  IF v_security_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: role guard must run as invoker so it can inspect caller role';
  END IF;

  SELECT count(*) INTO v_count FROM public.role_module_permissions;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: permission matrix rows exist before owner approval';
  END IF;

  SELECT count(*) INTO v_count FROM public.user_module_permissions;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: per-user overrides exist before reviewed administrative workflow';
  END IF;

  RAISE NOTICE 'PASS: authorization foundation catalog assertions passed';
END;
$test$;
