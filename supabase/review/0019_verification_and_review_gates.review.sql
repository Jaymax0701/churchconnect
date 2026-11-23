-- ============================================================
-- ChurchConnect
-- Review script: 0019_verification_and_review_gates.review.sql
-- Purpose: Read-only structural verification and post-approval
--          regression checklist for authorization migrations.
-- Status: READ-ONLY REVIEW SCRIPT — DOES NOT CHANGE DATA
--
-- Run only after the preceding migrations have been separately
-- reviewed and explicitly approved for execution.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Required authorization tables and row counts.
-- ------------------------------------------------------------

SELECT
    required.table_name,
    (to_regclass('public.' || required.table_name) IS NOT NULL) AS exists
FROM (
    VALUES
        ('ministries'),
        ('modules'),
        ('permissions'),
        ('role_permissions'),
        ('roles'),
        ('user_roles'),
        ('ministry_modules'),
        ('user_permission_overrides'),
        ('user_role_assignment_audit'),
        ('user_permission_override_audit'),
        ('ministry_module_audit')
) AS required(table_name)
ORDER BY required.table_name;


-- ------------------------------------------------------------
-- 2. RLS status for authorization tables.
-- ------------------------------------------------------------

SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
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
  AND c.relkind = 'r'
ORDER BY c.relname;


-- ------------------------------------------------------------
-- 3. Authorization functions and security settings.
-- ------------------------------------------------------------

SELECT
    p.oid::regprocedure AS function_signature,
    p.prosecdef AS security_definer,
    p.provolatile AS volatility,
    p.proconfig AS function_settings
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'current_user_has_ministry_assignment',
      'has_module_permission',
      'assign_ministry_role',
      'remove_ministry_role',
      'set_ministry_module_active',
      'set_user_permission_override',
      'remove_user_permission_override'
  )
ORDER BY p.proname, p.oid::regprocedure::text;


-- ------------------------------------------------------------
-- 4. Direct client privileges on authorization tables.
-- Expected design:
--   ministry_modules: authenticated SELECT only.
--   override and audit tables: no anon/authenticated privileges.
--   Existing table privileges must be reviewed separately.
-- ------------------------------------------------------------

SELECT
    table_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (
      'ministry_modules',
      'user_permission_overrides',
      'user_role_assignment_audit',
      'user_permission_override_audit',
      'ministry_module_audit'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;


-- ------------------------------------------------------------
-- 5. Policies on newly introduced authorization tables.
-- ------------------------------------------------------------

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
      'ministry_modules',
      'user_permission_overrides',
      'user_role_assignment_audit',
      'user_permission_override_audit',
      'ministry_module_audit'
  )
ORDER BY tablename, policyname;


-- ------------------------------------------------------------
-- 6. Canonical permission definition coverage.
-- Expected after approved seed migration:
--   12 canonical modules
--   7 actions
--   3 scopes
--   252 definitions
-- ------------------------------------------------------------

SELECT
    COUNT(*) AS permission_definitions,
    COUNT(DISTINCT module_id) AS module_count,
    COUNT(DISTINCT action) AS action_count,
    COUNT(DISTINCT scope) AS scope_count
FROM public.permissions
WHERE module_id IN (
    'public_site',
    'member_portal',
    'congregation',
    'cell_groups',
    'youth',
    'children',
    'women',
    'men',
    'evangelism',
    'praise_worship',
    'sunday_service',
    'cms'
);


-- ------------------------------------------------------------
-- 7. Canonical role grant totals.
-- Review against the approved capability profiles.
-- ------------------------------------------------------------

SELECT
    r.id AS role_id,
    r.name AS role_name,
    COUNT(p.id) AS grant_count
FROM public.roles AS r
LEFT JOIN public.role_permissions AS rp
    ON rp.role_id = r.id
LEFT JOIN public.permissions AS p
    ON p.id = rp.permission_id
   AND p.module_id IN (
        'public_site',
        'member_portal',
        'congregation',
        'cell_groups',
        'youth',
        'children',
        'women',
        'men',
        'evangelism',
        'praise_worship',
        'sunday_service',
        'cms'
   )
WHERE r.id IN (
    'superadmin',
    'church_admin',
    'church_council',
    'ministry_leader',
    'ministry_volunteer',
    'member'
)
GROUP BY r.id, r.name
ORDER BY r.id;


-- ------------------------------------------------------------
-- 8. Duplicate ministry role assignments.
-- Expected: zero rows.
-- The existing unique assignment index should prevent duplicates.
-- ------------------------------------------------------------

SELECT
    user_id,
    role_id,
    scope_type,
    ministry_id,
    COUNT(*) AS duplicate_count
FROM public.user_roles
GROUP BY
    user_id,
    role_id,
    scope_type,
    COALESCE(ministry_id, '00000000-0000-0000-0000-000000000000'::UUID)
HAVING COUNT(*) > 1;


-- ------------------------------------------------------------
-- 9. Invalid ministry assignment shape.
-- Expected: zero rows.
-- ------------------------------------------------------------

SELECT *
FROM public.user_roles
WHERE
    (scope_type = 'global' AND ministry_id IS NOT NULL)
    OR
    (scope_type = 'ministry' AND ministry_id IS NULL);


-- ------------------------------------------------------------
-- 10. Ministry mappings pointing to inactive ministries/modules.
-- These may legitimately exist and must not be deleted.
-- They should not produce ministry-derived permission grants.
-- ------------------------------------------------------------

SELECT
    mm.ministry_id,
    mn.name AS ministry_name,
    mm.module_id,
    mm.is_active AS mapping_active,
    mn.is_active AS ministry_active,
    mo.is_active AS module_active
FROM public.ministry_modules AS mm
JOIN public.ministries AS mn ON mn.id = mm.ministry_id
JOIN public.modules AS mo ON mo.id = mm.module_id
WHERE mm.is_active IS FALSE
   OR mn.is_active IS FALSE
   OR mo.is_active IS FALSE
ORDER BY mn.name, mm.module_id;


-- ------------------------------------------------------------
-- 11. Existing last-Superadmin safeguards.
-- Confirm trigger names and enabled status remain present.
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
      (n.nspname = 'auth' AND c.relname = 'users'
       AND t.tgname = 'guard_last_global_superadmin_auth_user')
      OR
      (n.nspname = 'public' AND c.relname = 'profiles'
       AND t.tgname = 'guard_last_global_superadmin_profile')
      OR
      (n.nspname = 'public' AND c.relname = 'user_roles'
       AND t.tgname = 'guard_last_global_superadmin_role')
      OR
      (n.nspname = 'public' AND c.relname = 'roles'
       AND t.tgname = 'guard_canonical_superadmin_role')
  )
ORDER BY schema_name, table_name, trigger_name;


-- ------------------------------------------------------------
-- 12. Append-only audit trigger status.
-- Expected: each audit table has a BEFORE UPDATE OR DELETE
-- trigger that rejects mutation.
-- ------------------------------------------------------------

SELECT
    c.relname AS table_name,
    t.tgname AS trigger_name,
    t.tgenabled AS enabled_state,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger AS t
JOIN pg_class AS c ON c.oid = t.tgrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND c.relname IN (
      'user_role_assignment_audit',
      'user_permission_override_audit',
      'ministry_module_audit'
  )
ORDER BY c.relname, t.tgname;


-- ------------------------------------------------------------
-- 13. Sentinel UUID collision review for the existing unique
-- user_roles expression index.
-- Expected: zero rows. The all-zero UUID must not be used as an
-- actual ministry ID because the existing unique index uses it
-- as the NULL/global-scope sentinel.
-- ------------------------------------------------------------

SELECT *
FROM public.user_roles
WHERE ministry_id = '00000000-0000-0000-0000-000000000000'::UUID;


-- ============================================================
-- MANUAL BEHAVIORAL REGRESSION TESTS
--
-- Run in a controlled test environment with dedicated test
-- accounts. Do not use the production Superadmin as a test
-- target and do not weaken the last-Superadmin protections.
--
-- A. Account and global roles
-- [ ] Unauthenticated caller receives FALSE from evaluator.
-- [ ] Unapproved account receives FALSE, including Superadmin.
-- [ ] Banned/deleted Auth account receives FALSE.
-- [ ] Superadmin baseline grants work only while approved/active.
-- [ ] Church Admin cannot grant global Superadmin.
-- [ ] Last active approved global Superadmin cannot be removed,
--     disabled, banned, or deleted through any mutation path.
--
-- B. Scope and role grants
-- [ ] Global role + global permission succeeds.
-- [ ] Global role + self permission succeeds only when record
--     owner equals auth.uid().
-- [ ] Ministry role succeeds only for its own ministry.
-- [ ] Ministry role cannot access another ministry's records.
-- [ ] Ministry role is suspended when ministry is inactive.
-- [ ] Ministry role is suspended when module mapping is inactive.
-- [ ] Reactivating ministry and mapping restores derived access.
--
-- C. Override behavior
-- [ ] Explicit DENY defeats ordinary role grant.
-- [ ] Explicit ALLOW grants only a correctly scoped permission.
-- [ ] Ministry override cannot grant access through inactive
--     ministry or inactive ministry-module mapping.
-- [ ] Superadmin is not reduced by ordinary user overrides.
-- [ ] Church Admin cannot alter overrides for Superadmin.
-- [ ] Override create/update/remove each writes one audit event.
--
-- D. Assignment governance
-- [ ] Superadmin and Church Admin can appoint/remove leaders
--     and volunteers in active ministries.
-- [ ] Ministry Leader can appoint/remove volunteers only in
--     their own active ministry.
-- [ ] Ministry Leader cannot appoint/remove another leader.
-- [ ] No user can assign themselves through the RPC.
-- [ ] Target must be an active, approved account.
-- [ ] Every successful assignment/removal writes an audit row.
-- [ ] Failed operation writes no audit row.
--
-- E. Data visibility and RLS
-- [ ] Module capability does not expose private rows by itself.
-- [ ] Member read access is limited to published/member-visible
--     resources by each resource table's RLS.
-- [ ] Self-service access is limited to the authenticated user.
-- [ ] Ministry leaders see only records in assigned ministries.
-- [ ] Browser clients cannot directly mutate authorization tables.
-- [ ] Audit tables cannot be modified by anon/authenticated.\n-- [ ] Audit UPDATE/DELETE triggers reject mutation.
--
-- F. Concurrency and integrity
-- [ ] Concurrent duplicate assignment attempts cannot create
--     duplicate user_roles rows.
-- [ ] Assignment state change and audit event are atomic.
-- [ ] Concurrent override upserts preserve one row per scope.
-- [ ] Override state change and audit event are atomic.
-- [ ] Existing Superadmin guard triggers remain enabled.
--
-- IMPORTANT LIMITATION
-- These scripts establish authorization metadata and workflows.
-- They do not automatically retrofit every existing resource
-- table's RLS policy or frontend authorization call. Those
-- require separate inventory, implementation, and testing.
-- ============================================================
