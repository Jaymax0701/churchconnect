-- Catalog-level verification for the 0004 authorization foundation draft.
-- Run only after the draft has been reviewed and deliberately applied to staging.
-- This does not replace behavioral tests using real authenticated test accounts.
-- Run as a trusted SQL Editor role with catalog visibility.

DO $test$
DECLARE
  v_count integer;
  v_security_definer boolean;
  v_function_config text[];
  v_table text;
  v_api_role text;
  v_privilege text;
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

  IF (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname IN ('profiles_select_own', 'profiles_update_own_name')
  ) <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected exactly the two named foundation profile policies';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND t.tgname = 'guard_profile_approval_fields'
      AND NOT t.tgisinternal
      AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'FAIL: enabled profile approval-field guard trigger missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_roles'
      AND t.tgname = 'guard_user_role_mutations'
      AND NOT t.tgisinternal
      AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'FAIL: enabled direct role-assignment guard trigger missing';
  END IF;

  IF has_table_privilege('anon', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon unexpectedly has SELECT on profiles';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated lacks SELECT grant required by own-profile policy';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated lacks the intended full_name column UPDATE grant';
  END IF;

  IF has_column_privilege('authenticated', 'public.profiles', 'is_approved', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.profiles', 'approved_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.profiles', 'approved_by', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can update protected profile fields';
  END IF;

  -- The foundation intentionally grants no table-level CRUD or unsafe
  -- privileges to API roles. Own-profile SELECT and full_name column UPDATE
  -- are the only expected exceptions, and are checked separately above.
  FOREACH v_table IN ARRAY ARRAY[
    'ministries', 'modules', 'permissions', 'profiles', 'role_permissions',
    'roles', 'user_roles', 'role_module_permissions',
    'user_module_permissions', 'security_bootstrap_audit'
  ] LOOP
    FOREACH v_api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      FOREACH v_privilege IN ARRAY ARRAY[
        'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
      ] LOOP
        IF has_table_privilege(v_api_role, format('public.%I', v_table), v_privilege) THEN
          RAISE EXCEPTION 'FAIL: role % unexpectedly has table privilege % on public.%', v_api_role, v_privilege, v_table;
        END IF;
      END LOOP;

      IF NOT (v_api_role = 'authenticated' AND v_table = 'profiles')
         AND has_table_privilege(v_api_role, format('public.%I', v_table), 'SELECT') THEN
        RAISE EXCEPTION 'FAIL: role % unexpectedly has table-level SELECT on public.%', v_api_role, v_table;
      END IF;
    END LOOP;
  END LOOP;

  SELECT prosecdef, proconfig INTO v_security_definer, v_function_config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'guard_profile_approval_fields'
    AND p.pronargs = 0;

  IF v_security_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: approval guard must run as invoker so it can inspect caller role';
  END IF;
  IF NOT (coalesce(v_function_config, ARRAY[]::text[]) @> ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'FAIL: approval guard must have an empty search_path';
  END IF;

  SELECT prosecdef, proconfig INTO v_security_definer, v_function_config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'guard_user_role_mutations'
    AND p.pronargs = 0;

  IF v_security_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: role guard must run as invoker so it can inspect caller role';
  END IF;
  IF NOT (coalesce(v_function_config, ARRAY[]::text[]) @> ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'FAIL: role guard must have an empty search_path';
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
