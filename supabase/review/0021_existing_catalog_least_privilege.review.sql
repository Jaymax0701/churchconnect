-- ============================================================
-- ChurchConnect
-- Review script: 0021_existing_catalog_least_privilege.review.sql
-- Purpose: Remove excessive direct client privileges from the
--          existing ministries and modules catalog tables.
-- Status: MANUAL REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL
--
-- Run only after review scripts 0014 through 0018 have been
-- separately approved and applied in sequence.
--
-- Existing live state observed in preflight 0020:
--   anon and authenticated currently have broad table privileges
--   on ministries and modules, including write/TRUNCATE rights.
--
-- This script:
--   1. Revokes all direct client privileges on both catalog tables.
--   2. Restores authenticated SELECT only.
--   3. Adds narrowly scoped RLS read policies.
--   4. Adds a SECURITY DEFINER helper for checking whether the
--      current approved user belongs to a ministry.
--
-- It does not grant direct client INSERT/UPDATE/DELETE/TRUNCATE.
-- It does not grant anon access.
-- It does not change ministry/module records.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Helper: current approved user belongs to a ministry.
--
-- Used only to let an assigned ministry leader or volunteer
-- read the metadata for their own ministry. This is deliberately
-- separate from current_user_has_ministry_assignment(UUID), which
-- is narrower and is used for ministry-module mapping visibility.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_has_ministry_membership(
    p_ministry_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        public.current_user_is_active_approved()
        AND p_ministry_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.user_roles AS ur
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.scope_type = 'ministry'
              AND ur.ministry_id = p_ministry_id
              AND ur.role_id IN (
                  'ministry_leader',
                  'ministry_volunteer'
              )
        );
$function$;

REVOKE ALL ON FUNCTION
    public.current_user_has_ministry_membership(UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.current_user_has_ministry_membership(UUID)
TO authenticated;


-- ------------------------------------------------------------
-- 2. Remove all direct client table privileges.
--
-- REVOKE ALL removes SELECT, INSERT, UPDATE, DELETE, REFERENCES,
-- TRIGGER and (for modules) TRUNCATE from these client roles.
-- Explicit SELECT is restored only for authenticated users.
-- PUBLIC is included to remove inherited PUBLIC grants.
-- ------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE
    public.ministries,
    public.modules
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    public.ministries,
    public.modules
TO authenticated;


-- ------------------------------------------------------------
-- 3. Ministry metadata visibility.
--
-- Active, approved global Superadmins and Church Admins may read
-- all ministries, including inactive ones for administration.
-- Active, approved ministry leaders and volunteers may read only
-- the ministry to which they are assigned.
--
-- Inactive ministry metadata remains visible to its assigned
-- users, but this policy grants no operational access by itself.
-- ------------------------------------------------------------

ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ministries_select_authorized
    ON public.ministries;

CREATE POLICY ministries_select_authorized
ON public.ministries
FOR SELECT
TO authenticated
USING (
    public.current_user_is_active_approved()
    AND (
        public.current_user_has_role('superadmin')
        OR public.current_user_has_role('church_admin')
        OR public.current_user_has_ministry_membership(id)
    )
);


-- ------------------------------------------------------------
-- 4. Module catalog visibility.
--
-- Active, approved global administrators may read the complete
-- catalog, including inactive module definitions.
-- Other active, approved users may read active modules only.
-- No anonymous catalog access is granted.
-- ------------------------------------------------------------

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS modules_select_authorized
    ON public.modules;

CREATE POLICY modules_select_authorized
ON public.modules
FOR SELECT
TO authenticated
USING (
    public.current_user_is_active_approved()
    AND (
        public.current_user_has_role('superadmin')
        OR public.current_user_has_role('church_admin')
        OR is_active IS TRUE
    )
);

COMMIT;


-- ------------------------------------------------------------
-- 5. Read-only verification.
-- Expected:
--   * authenticated: SELECT only on ministries and modules.
--   * anon: no direct privileges on either table.
--   * no client INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER.
--   * one SELECT policy per table, as defined above.
-- ------------------------------------------------------------

SELECT
    table_name,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('ministries', 'modules')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ministries', 'modules')
ORDER BY tablename, policyname;

SELECT
    p.oid::regprocedure AS function_signature,
    pg_get_userbyid(p.proowner) AS function_owner,
    p.prosecdef AS security_definer,
    p.proconfig AS function_settings,
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
        AS authenticated_can_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE')
        AS anon_can_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'current_user_has_ministry_membership';


-- ============================================================
-- MANUAL REVIEW GATES
--
-- [ ] Scripts 0014-0018 have been separately reviewed/applied.
-- [ ] The current_user_is_active_approved() helper exists.
-- [ ] Existing frontend reads of ministries/modules are
--     compatible with authenticated SELECT and the RLS policies.
-- [ ] Ministry leaders/volunteers can read only their assigned
--     ministry metadata.
-- [ ] Admins can read inactive ministry/module catalog entries.
-- [ ] anon has no direct privileges on either table.
-- [ ] authenticated has SELECT only; no direct write/TRUNCATE.
-- [ ] service_role/server-side workflows retain required access.
--
-- This script is not approved for execution merely by being
-- committed to the review branch.
-- ============================================================
