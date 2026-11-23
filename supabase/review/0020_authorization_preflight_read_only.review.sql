-- ============================================================
-- ChurchConnect
-- Review script: 0020_authorization_preflight_read_only.review.sql
-- Purpose: Read-only verification of live schema assumptions
--          before any authorization SQL is approved for execution.
-- Status: READ-ONLY — NO DDL, DML, GRANTS OR POLICY CHANGES
--
-- Run in the active Supabase SQL Editor and review every result.
-- Do not proceed if any required column/table/function is missing
-- or differs from the expected shape.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Required table existence.
-- ------------------------------------------------------------

SELECT
    required.schema_name,
    required.table_name,
    to_regclass(format('%I.%I', required.schema_name, required.table_name))
        IS NOT NULL AS exists
FROM (
    VALUES
        ('public', 'profiles'),
        ('public', 'ministries'),
        ('public', 'modules'),
        ('public', 'permissions'),
        ('public', 'role_permissions'),
        ('public', 'roles'),
        ('public', 'user_roles'),
        ('auth', 'users'),
        ('public', 'ministry_modules'),
        ('public', 'user_permission_overrides'),
        ('public', 'user_role_assignment_audit'),
        ('public', 'user_permission_override_audit'),
        ('public', 'ministry_module_audit')
) AS required(schema_name, table_name)
ORDER BY required.schema_name, required.table_name;


-- ------------------------------------------------------------
-- 2. Exact profile and Auth columns used by the review scripts.
-- Expected:
--   profiles.id uuid
--   profiles.is_approved boolean NOT NULL
--   auth.users.id uuid
--   auth.users.deleted_at timestamptz
--   auth.users.banned_until timestamptz
--
-- The auth.users status-column assumptions are a hard gate.
-- ------------------------------------------------------------

SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnotnull AS not_null,
    pg_get_expr(ad.adbin, ad.adrelid) AS default_expression
FROM pg_attribute AS a
JOIN pg_class AS c ON c.oid = a.attrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef AS ad
    ON ad.adrelid = a.attrelid
   AND ad.adnum = a.attnum
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND (
      (n.nspname = 'public' AND c.relname = 'profiles'
       AND a.attname IN ('id', 'is_approved', 'approved_at', 'approved_by'))
      OR
      (n.nspname = 'auth' AND c.relname = 'users'
       AND a.attname IN ('id', 'deleted_at', 'banned_until'))
  )
ORDER BY n.nspname, c.relname, a.attnum;


-- ------------------------------------------------------------
-- 3. Existing role and module catalog.
-- ------------------------------------------------------------

SELECT id, name, is_system
FROM public.roles
ORDER BY id;

SELECT id, name, is_active
FROM public.modules
ORDER BY id;

SELECT
    COUNT(*) AS total_modules,
    COUNT(*) FILTER (WHERE is_active) AS active_modules
FROM public.modules;


-- ------------------------------------------------------------
-- 3A. Exact canonical role IDs and system flags.
-- Expected: six canonical roles from the approved matrix.
-- ------------------------------------------------------------

SELECT id, name, is_system
FROM public.roles
ORDER BY id;


-- ------------------------------------------------------------
-- 3B. Potential function-name/signature collisions.
-- These names are introduced or replaced by scripts 0016-0018.
-- Review any returned row before approving those scripts.
-- Expected before first application: zero rows for these names.
-- ------------------------------------------------------------

SELECT
    p.oid::regprocedure AS function_signature,
    pg_get_userbyid(p.proowner) AS function_owner,
    p.prosecdef AS security_definer,
    p.proconfig AS function_settings,
    p.proacl AS function_acl
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'current_user_is_active_approved',
      'current_user_has_ministry_assignment',
      'has_module_permission',
      'assign_ministry_role',
      'remove_ministry_role',
      'set_ministry_module_active',
      'set_user_permission_override',
      'remove_user_permission_override',
      'prevent_authorization_audit_mutation'
  )
ORDER BY p.proname, p.oid::regprocedure::text;


-- ------------------------------------------------------------
-- 3C. Existing direct table privileges.
-- The new tables should not exist yet. Existing user_roles,
-- permissions and role_permissions should not expose unintended
-- direct client write privileges.
-- ------------------------------------------------------------

SELECT
    table_name,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
      'ministries',
      'modules',
      'permissions',
      'role_permissions',
      'roles',
      'user_roles'
  )
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;


-- ------------------------------------------------------------
-- 4. Existing authorization table columns.
-- ------------------------------------------------------------

SELECT
    c.relname AS table_name,
    a.attnum AS ordinal_position,
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnotnull AS not_null,
    pg_get_expr(ad.adbin, ad.adrelid) AS default_expression
FROM pg_attribute AS a
JOIN pg_class AS c ON c.oid = a.attrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef AS ad
    ON ad.adrelid = a.attrelid
   AND ad.adnum = a.attnum
WHERE n.nspname = 'public'
  AND c.relname IN (
      'ministries',
      'modules',
      'permissions',
      'role_permissions',
      'roles',
      'user_roles'
  )
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;


-- ------------------------------------------------------------
-- 5. Constraints and indexes used by the authorization scripts.
-- ------------------------------------------------------------

SELECT
    c.relname AS table_name,
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'ministries',
      'modules',
      'permissions',
      'role_permissions',
      'roles',
      'user_roles'
  )
ORDER BY c.relname, con.conname;

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('permissions', 'role_permissions', 'user_roles')
ORDER BY tablename, indexname;


-- ------------------------------------------------------------
-- 6. Current global-role check function definition and security.
-- Confirm the live body checks both global role assignment and
-- profiles.is_approved. Do not replace it with the old 0002
-- historical review definition.
-- ------------------------------------------------------------

SELECT
    p.oid::regprocedure AS function_signature,
    pg_get_userbyid(p.proowner) AS function_owner,
    p.prosecdef AS security_definer,
    p.provolatile AS volatility,
    p.proconfig AS function_settings,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'current_user_has_role'
ORDER BY p.oid::regprocedure::text;


-- ------------------------------------------------------------
-- 7. Existing authorization function execution grants.
-- ------------------------------------------------------------

SELECT
    p.oid::regprocedure AS function_signature,
    pg_get_userbyid(p.proowner) AS function_owner,
    p.prosecdef AS security_definer,
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
        AS authenticated_can_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE')
        AS anon_can_execute,
    p.proconfig AS function_settings
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'current_user_has_role',
      'approve_account',
      'review_minor_registration',
      'assert_another_active_global_superadmin'
  )
ORDER BY p.proname, p.oid::regprocedure::text;


-- ------------------------------------------------------------
-- 8. Existing RLS state and policies on authorization tables.
-- ------------------------------------------------------------

SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'profiles',
      'ministries',
      'modules',
      'permissions',
      'role_permissions',
      'roles',
      'user_roles',
      'ministry_modules',
      'user_permission_overrides',
      'user_role_assignment_audit',
      'user_permission_override_audit',
      'ministry_module_audit'
  )
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'profiles',
      'ministries',
      'modules',
      'permissions',
      'role_permissions',
      'roles',
      'user_roles',
      'ministry_modules',
      'user_permission_overrides',
      'user_role_assignment_audit',
      'user_permission_override_audit',
      'ministry_module_audit'
  )
ORDER BY tablename, policyname;


-- ------------------------------------------------------------
-- 9. Existing last-Superadmin triggers.
-- Confirm all expected safeguards exist and are enabled.
-- ------------------------------------------------------------

SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    t.tgenabled AS enabled_state,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger AS t
JOIN pg_class AS c ON c.oid = t.tgrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND (
      (n.nspname = 'auth' AND c.relname = 'users')
      OR
      (n.nspname = 'public' AND c.relname IN ('profiles', 'user_roles', 'roles'))
  )
  AND (
      t.tgname ILIKE '%superadmin%'
      OR t.tgname ILIKE '%super_admin%'
  )
ORDER BY n.nspname, c.relname, t.tgname;


-- ------------------------------------------------------------
-- 10. Existing objects that would conflict with new tables.
-- Expected before first application: all new tables absent.
-- If any already exist, inspect them before proceeding.
-- ------------------------------------------------------------

SELECT
    candidate.table_name,
    to_regclass('public.' || candidate.table_name) IS NOT NULL
        AS already_exists
FROM (
    VALUES
        ('ministry_modules'),
        ('user_permission_overrides'),
        ('user_role_assignment_audit'),
        ('user_permission_override_audit'),
        ('ministry_module_audit')
) AS candidate(table_name)
ORDER BY candidate.table_name;


-- ============================================================
-- MANUAL REVIEW GATES — DO NOT SKIP
--
-- [ ] profiles.id is UUID and is the Auth user ID.
-- [ ] profiles.is_approved exists, is BOOLEAN and NOT NULL.
-- [ ] auth.users.deleted_at exists and has the expected type.
-- [ ] auth.users.banned_until exists and has the expected type.
-- [ ] current_user_has_role(text) is the verified live function;
--     its body checks approved profiles and global role scope.
-- [ ] Existing canonical role and module IDs match the matrix.
-- [ ] Existing unique user_roles expression index is confirmed.
-- [ ] Existing last-Superadmin triggers are present and enabled.
-- [ ] New authorization tables do not already exist unexpectedly.
-- [ ] Function owners and RLS behavior are understood.
--
-- This script is SELECT-only. It does not prove the six migration
-- scripts are safe to execute; it supplies the live facts needed
-- to complete that review.
-- ============================================================
