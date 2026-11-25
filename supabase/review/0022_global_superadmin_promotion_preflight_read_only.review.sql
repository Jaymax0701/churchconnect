-- ============================================================
-- ChurchConnect
-- Review script: 0022_global_superadmin_promotion_preflight_read_only.review.sql
-- Purpose: Read-only inspection for a future trusted global-role
--          promotion procedure.
-- Status: READ-ONLY — NO DDL, DML, GRANTS OR POLICY CHANGES
--
-- Run only in the active Supabase SQL Editor when requested.
-- This script does not promote anyone and does not change data.
-- ============================================================

-- 1. Confirm exact live columns and defaults on the target tables.
SELECT
    n.nspname AS schema_name,
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
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND (
      (n.nspname = 'public' AND c.relname IN
          ('profiles', 'roles', 'user_roles', 'user_role_assignment_audit'))
      OR
      (n.nspname = 'auth' AND c.relname = 'users'
       AND a.attname IN ('id', 'deleted_at', 'banned_until'))
  )
ORDER BY n.nspname, c.relname, a.attnum;

-- 2. Confirm constraints on role assignments and audit history.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('roles', 'user_roles', 'user_role_assignment_audit')
ORDER BY c.relname, con.conname;

-- 3. Confirm all indexes on user_roles, including unique expression indexes.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_roles'
ORDER BY indexname;

-- 4. Confirm whether the proposed authorization audit table exists,
--    and inspect its RLS and ownership state.
SELECT
    to_regclass('public.user_role_assignment_audit') IS NOT NULL
        AS role_assignment_audit_exists,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls,
    pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class AS c
WHERE c.oid = to_regclass('public.user_role_assignment_audit');

-- 5. Inspect current global Superadmin assignments and target state.
--    This is read-only. Treat user identifiers as confidential.
SELECT
    ur.id AS assignment_id,
    ur.user_id,
    ur.role_id,
    ur.scope_type,
    ur.ministry_id,
    ur.assigned_by,
    ur.created_at,
    pr.is_approved,
    au.deleted_at,
    au.banned_until,
    (
        pr.is_approved IS TRUE
        AND au.deleted_at IS NULL
        AND (au.banned_until IS NULL OR au.banned_until <= NOW())
    ) AS is_active_approved
FROM public.user_roles AS ur
LEFT JOIN public.profiles AS pr ON pr.id = ur.user_id
LEFT JOIN auth.users AS au ON au.id = ur.user_id
WHERE ur.role_id = 'superadmin'
ORDER BY ur.created_at, ur.user_id;

-- 6. Inspect role-assignment audit schema and current global events.
--    If the audit table does not exist, the second query returns no rows.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    a.attnum AS ordinal_position,
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnotnull AS not_null
FROM pg_attribute AS a
JOIN pg_class AS c ON c.oid = a.attrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'user_role_assignment_audit'
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;

SELECT *
FROM public.user_role_assignment_audit
WHERE role_id = 'superadmin'
  AND scope_type = 'global'
ORDER BY occurred_at DESC
LIMIT 50;

-- 7. Reconfirm live Superadmin protection triggers and definitions.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    t.tgenabled AS enabled_state,
    pg_get_triggerdef(t.oid) AS trigger_definition,
    pg_get_functiondef(t.tgfoid) AS trigger_function_definition
FROM pg_trigger AS t
JOIN pg_class AS c ON c.oid = t.tgrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND (
      (n.nspname = 'auth' AND c.relname = 'users')
      OR
      (n.nspname = 'public' AND c.relname IN ('profiles', 'user_roles', 'roles'))
  )
  AND t.tgname ILIKE '%superadmin%'
ORDER BY n.nspname, c.relname, t.tgname;

-- 8. Inspect all current functions that can mutate user_roles or
--    reference global Superadmin assignment. This is a catalog
--    search aid, not proof that external/manual paths are absent.
SELECT
    p.oid::regprocedure AS function_signature,
    pg_get_userbyid(p.proowner) AS function_owner,
    p.prosecdef AS security_definer,
    p.proconfig AS function_settings,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
      pg_get_functiondef(p.oid) ILIKE '%user_roles%'
      OR pg_get_functiondef(p.oid) ILIKE '%superadmin%'
  )
ORDER BY p.proname, p.oid::regprocedure::text;

-- ============================================================
-- REVIEW GATES — DO NOT IMPLEMENT A PROMOTION OPERATION UNTIL:
--
-- [ ] Exact live user_roles column/constraint/index definitions are confirmed.
-- [ ] The role_assignment_audit table exists and its schema is confirmed,
--     or a separately approved audit design is prepared.
-- [ ] Current global Superadmin rows and active/approved state are reconciled.
-- [ ] Existing triggers/functions and their lock order are re-reviewed.
-- [ ] External/manual/service-role role mutation paths are owner-inventoried.
-- [ ] The procedure locks the target auth.users row before role assignment,
--     using a deterministic lock order compatible with 0018.
-- [ ] The procedure validates target Auth status and approved profile while
--     holding the relevant locks.
-- [ ] It rejects self-promotion for application-facing operations; a manual
--     break-glass bootstrap must be a separate, explicitly governed path.
-- [ ] It writes an atomic audit event and fails closed if audit fails.
-- [ ] It has an idempotency/duplicate-assignment strategy consistent with
--     the actual unique index and does not overwrite existing assignments.
-- [ ] PostgreSQL parser, disposable-database, RLS, privilege and concurrency
--     tests pass before any execution is considered.
--
-- This file is SELECT-only. It neither authorizes nor performs promotion.
-- ============================================================
