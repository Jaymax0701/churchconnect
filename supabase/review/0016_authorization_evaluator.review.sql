-- ============================================================
-- ChurchConnect
-- Review script: 0016_authorization_evaluator.review.sql
-- Purpose: Central permission evaluation and ministry-membership
--          helper for RLS.
-- Status: MANUAL REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL
--
-- Uses the existing permissions, role_permissions, roles,
-- user_roles, profiles, modules and ministry_modules tables.
-- No authorization data is modified.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Shared active/approved caller check.
-- Prevents an approved-but-banned/deleted Auth account from
-- invoking privileged workflows with an otherwise valid JWT.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_is_active_approved()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM auth.users AS au
            JOIN public.profiles AS pr ON pr.id = au.id
            WHERE au.id = auth.uid()
              AND au.deleted_at IS NULL
              AND (au.banned_until IS NULL OR au.banned_until <= NOW())
              AND pr.is_approved IS TRUE
       );
$function$;

REVOKE ALL ON FUNCTION public.current_user_is_active_approved()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_user_is_active_approved()
TO authenticated;


-- ------------------------------------------------------------
-- 1. RLS helper: caller has an assignment in a ministry.
-- The caller identity always comes from auth.uid(); no arbitrary
-- user ID can be supplied by the client.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_has_ministry_assignment(
    p_ministry_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        auth.uid() IS NOT NULL
        AND p_ministry_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.user_roles AS ur
            JOIN public.profiles AS pr
              ON pr.id = ur.user_id
            JOIN auth.users AS au
              ON au.id = ur.user_id
            WHERE ur.user_id = auth.uid()
              AND ur.scope_type = 'ministry'
              AND ur.role_id = 'ministry_leader'
              AND ur.ministry_id = p_ministry_id
              AND pr.is_approved IS TRUE
              AND au.deleted_at IS NULL
              AND (au.banned_until IS NULL OR au.banned_until <= NOW())
        );
$function$;

REVOKE ALL ON FUNCTION
    public.current_user_has_ministry_assignment(UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.current_user_has_ministry_assignment(UUID)
TO authenticated;


-- ------------------------------------------------------------
-- 2. Central permission evaluator.
--
-- Evaluation order:
--   a. Require authenticated, active, approved account.
--   b. Require active module and valid action.
--   c. Determine whether caller is approved global Superadmin.
--   d. For non-Superadmins, explicit matching DENY overrides
--      any role grant.
--   e. Resolve baseline role grants:
--        global assignment + global permission scope;
--        ministry assignment + assigned_ministry scope with
--        active ministry and active ministry-module mapping;
--        global assignment + self scope only for own record.
--   f. For non-Superadmins, explicit ALLOW may grant only when
--      its scope is valid and ministry context is active.
--
-- Resource-level RLS remains mandatory. This function does not
-- determine which rows are published, private, or owned by a
-- particular ministry.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_module_permission(
    p_module_id TEXT,
    p_action TEXT,
    p_ministry_id UUID DEFAULT NULL,
    p_record_owner_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_superadmin BOOLEAN := FALSE;
    v_has_role_grant BOOLEAN := FALSE;
    v_has_override_allow BOOLEAN := FALSE;
    v_has_override_deny BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL
       OR p_module_id IS NULL
       OR p_action IS NULL THEN
        RETURN FALSE;
    END IF;

    IF p_action NOT IN (
        'view', 'create', 'update', 'delete',
        'manage', 'approve', 'assign'
    ) THEN
        RETURN FALSE;
    END IF;

    -- Authentication and account approval are mandatory even for
    -- Superadmin. This is not a replacement for Auth session checks.
    IF NOT EXISTS (
        SELECT 1
        FROM auth.users AS au
        JOIN public.profiles AS pr ON pr.id = au.id
        WHERE au.id = v_user_id
          AND au.deleted_at IS NULL
          AND (au.banned_until IS NULL OR au.banned_until <= NOW())
          AND pr.is_approved IS TRUE
    ) THEN
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.modules AS m
        WHERE m.id = p_module_id
          AND m.is_active IS TRUE
    ) THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        JOIN public.roles AS r ON r.id = ur.role_id
        WHERE ur.user_id = v_user_id
          AND ur.role_id = 'superadmin'
          AND ur.scope_type = 'global'
          AND r.is_system IS TRUE
    )
    INTO v_is_superadmin;

    -- Ordinary per-user overrides never reduce Superadmin's
    -- canonical baseline. Superadmin still needs a baseline grant.
    IF NOT v_is_superadmin THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.user_permission_overrides AS uo
            JOIN public.permissions AS p
              ON p.id = uo.permission_id
            WHERE uo.user_id = v_user_id
              AND p.module_id = p_module_id
              AND p.action = p_action
              AND (
                    (uo.ministry_id IS NULL AND p.scope = 'global')
                    OR
                    (uo.ministry_id IS NULL
                     AND p.scope = 'self'
                     AND p_record_owner_id = v_user_id)
                    OR
                    (uo.ministry_id IS NOT NULL
                     AND p.scope = 'assigned_ministry'
                     AND uo.ministry_id = p_ministry_id)
              )
              AND (
                    uo.ministry_id IS NULL
                    OR EXISTS (
                        SELECT 1
                        FROM public.ministries AS mn
                        JOIN public.ministry_modules AS mm
                          ON mm.ministry_id = mn.id
                        WHERE mn.id = uo.ministry_id
                          AND mn.is_active IS TRUE
                          AND mm.module_id = p_module_id
                          AND mm.is_active IS TRUE
                    )
              )
              AND uo.is_allowed IS FALSE
        )
        INTO v_has_override_deny;

        IF v_has_override_deny THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Baseline grants.
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        JOIN public.role_permissions AS rp
          ON rp.role_id = ur.role_id
        JOIN public.permissions AS p
          ON p.id = rp.permission_id
        WHERE ur.user_id = v_user_id
          AND p.module_id = p_module_id
          AND p.action = p_action
          AND (
                (
                    ur.scope_type = 'global'
                    AND p.scope = 'global'
                )
                OR
                (
                    ur.scope_type = 'global'
                    AND p.scope = 'self'
                    AND p_record_owner_id = v_user_id
                )
                OR
                (
                    ur.scope_type = 'ministry'
                    AND p.scope = 'assigned_ministry'
                    AND p_ministry_id IS NOT NULL
                    AND ur.ministry_id = p_ministry_id
                    AND EXISTS (
                        SELECT 1
                        FROM public.ministries AS mn
                        JOIN public.ministry_modules AS mm
                          ON mm.ministry_id = mn.id
                        WHERE mn.id = ur.ministry_id
                          AND mn.is_active IS TRUE
                          AND mm.module_id = p_module_id
                          AND mm.is_active IS TRUE
                    )
                )
          )
    )
    INTO v_has_role_grant;

    IF v_has_role_grant THEN
        RETURN TRUE;
    END IF;

    -- Explicit ALLOW overrides may grant an otherwise absent
    -- permission, but cannot activate an inactive ministry or
    -- inactive ministry-module mapping.
    IF NOT v_is_superadmin THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.user_permission_overrides AS uo
            JOIN public.permissions AS p
              ON p.id = uo.permission_id
            WHERE uo.user_id = v_user_id
              AND uo.is_allowed IS TRUE
              AND p.module_id = p_module_id
              AND p.action = p_action
              AND (
                    (
                        uo.ministry_id IS NULL
                        AND p.scope = 'global'
                    )
                    OR
                    (
                        uo.ministry_id IS NULL
                        AND p.scope = 'self'
                        AND p_record_owner_id = v_user_id
                    )
                    OR
                    (
                        uo.ministry_id IS NOT NULL
                        AND p.scope = 'assigned_ministry'
                        AND uo.ministry_id = p_ministry_id
                        AND EXISTS (
                            SELECT 1
                            FROM public.user_roles AS assigned_role
                            WHERE assigned_role.user_id = v_user_id
                              AND assigned_role.scope_type = 'ministry'
                              AND assigned_role.ministry_id = uo.ministry_id
                        )
                        AND EXISTS (
                            SELECT 1
                            FROM public.ministries AS mn
                            JOIN public.ministry_modules AS mm
                              ON mm.ministry_id = mn.id
                            WHERE mn.id = uo.ministry_id
                              AND mn.is_active IS TRUE
                              AND mm.module_id = p_module_id
                              AND mm.is_active IS TRUE
                        )
                    )
              )
        )
        INTO v_has_override_allow;

        IF v_has_override_allow THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$function$;

REVOKE ALL ON FUNCTION
    public.has_module_permission(TEXT, TEXT, UUID, UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.has_module_permission(TEXT, TEXT, UUID, UUID)
TO authenticated;

COMMIT;

-- ============================================================
-- REVIEW GATES
--
-- 1. Confirm profiles.id is UUID and references auth.users.id.
-- 2. Confirm profiles.is_approved, auth.users.deleted_at and
--    auth.users.banned_until exist in the active project.
-- 3. Confirm approved Superadmin assignment is protected by the
--    existing trigger and profile approval safeguards.
-- 4. Test global, self, and ministry scope independently.
-- 5. Test explicit DENY precedence and Superadmin exception.
-- 6. Test inactive ministry and inactive mapping suspension.
-- 7. Test that global administrators can still use global
--    permissions to reactivate a ministry or mapping.
-- 8. Review every resource table's RLS separately.
--
-- NOTE: This evaluator assumes a global permission override
-- uses a permission definition with scope='global', and a
-- self override uses scope='self'. Ministry overrides require
-- scope='assigned_ministry' and a matching active mapping.
-- ============================================================
