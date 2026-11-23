-- ============================================================
-- ChurchConnect
-- Review script: 0018_override_workflows_and_rls.review.sql
-- Purpose: Permission override administration and narrow
--          ministry-module read access.
-- Status: MANUAL REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Set or replace a user's permission override.
-- Only approved global Superadmin and Church Admin.
-- Church Admin cannot modify overrides for a Superadmin.
-- Permission scope must match the override context:
--   ministry_id NULL     => global or self permission
--   ministry_id non-NULL => assigned_ministry permission
--
-- Upsert uses the existing partial unique indexes, avoiding
-- a SELECT-then-INSERT race. Audit and state change are atomic.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_user_permission_override(
    p_target_user_id UUID,
    p_permission_id UUID,
    p_ministry_id UUID,
    p_is_allowed BOOLEAN,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := auth.uid();
    v_is_superadmin BOOLEAN := FALSE;
    v_is_allowed BOOLEAN;
    v_override_id UUID;
    v_scope TEXT;
BEGIN
    IF v_actor IS NULL
       OR NOT (
            public.current_user_has_role('superadmin')
            OR public.current_user_has_role('church_admin')
       ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_target_user_id IS NULL
       OR p_permission_id IS NULL
       OR p_is_allowed IS NULL
       OR p_reason IS NULL
       OR length(btrim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Target, permission, decision and reason are required';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        WHERE ur.user_id = p_target_user_id
          AND ur.role_id = 'superadmin'
          AND ur.scope_type = 'global'
    )
    INTO v_is_superadmin;

    IF v_is_superadmin
       AND NOT public.current_user_has_role('superadmin') THEN
        RAISE EXCEPTION 'Church Admin cannot modify a Superadmin permission override';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM auth.users AS au
        JOIN public.profiles AS pr ON pr.id = au.id
        WHERE au.id = p_target_user_id
          AND au.deleted_at IS NULL
          AND (au.banned_until IS NULL OR au.banned_until <= NOW())
          AND pr.is_approved IS TRUE
    ) THEN
        RAISE EXCEPTION 'Target account must be active and approved';
    END IF;

    SELECT p.scope
    INTO v_scope
    FROM public.permissions AS p
    WHERE p.id = p_permission_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Permission definition not found';
    END IF;

    IF p_ministry_id IS NULL THEN
        IF v_scope NOT IN ('global', 'self') THEN
            RAISE EXCEPTION 'This permission requires a ministry context';
        END IF;
    ELSE
        IF v_scope <> 'assigned_ministry' THEN
            RAISE EXCEPTION 'Ministry override requires assigned_ministry permission scope';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.ministries
            WHERE id = p_ministry_id
        ) THEN
            RAISE EXCEPTION 'Ministry not found';
        END IF;
    END IF;

    IF p_ministry_id IS NULL THEN
        INSERT INTO public.user_permission_overrides (
            user_id, permission_id, ministry_id,
            is_allowed, reason, created_by, updated_by
        )
        VALUES (
            p_target_user_id, p_permission_id, NULL,
            p_is_allowed, btrim(p_reason), v_actor, v_actor
        )
        ON CONFLICT (user_id, permission_id)
            WHERE ministry_id IS NULL
        DO UPDATE SET
            is_allowed = EXCLUDED.is_allowed,
            reason = EXCLUDED.reason,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
        RETURNING id, is_allowed
        INTO v_override_id, v_is_allowed;
    ELSE
        INSERT INTO public.user_permission_overrides (
            user_id, permission_id, ministry_id,
            is_allowed, reason, created_by, updated_by
        )
        VALUES (
            p_target_user_id, p_permission_id, p_ministry_id,
            p_is_allowed, btrim(p_reason), v_actor, v_actor
        )
        ON CONFLICT (user_id, permission_id, ministry_id)
            WHERE ministry_id IS NOT NULL
        DO UPDATE SET
            is_allowed = EXCLUDED.is_allowed,
            reason = EXCLUDED.reason,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
        RETURNING id, is_allowed
        INTO v_override_id, v_is_allowed;
    END IF;

    -- Determine whether this operation created or updated the row.
    -- The audit event always records the final decision. The old
    -- decision is looked up from the most recent earlier audit
    -- event for this override; absent history means creation.
    INSERT INTO public.user_permission_override_audit (
        override_id, target_user_id, permission_id, ministry_id,
        operation, old_is_allowed, new_is_allowed,
        actor_user_id, reason
    )
    SELECT
        v_override_id,
        p_target_user_id,
        p_permission_id,
        p_ministry_id,
        CASE
            WHEN prior.id IS NULL THEN 'created'
            ELSE 'updated'
        END,
        prior.new_is_allowed,
        p_is_allowed,
        v_actor,
        btrim(p_reason)
    FROM (
        SELECT a.id, a.new_is_allowed
        FROM public.user_permission_override_audit AS a
        WHERE a.override_id = v_override_id
        ORDER BY a.occurred_at DESC, a.id DESC
        LIMIT 1
    ) AS prior
    RIGHT JOIN (SELECT 1) AS seed ON TRUE;

    RETURN v_override_id;
END;
$function$;

REVOKE ALL ON FUNCTION
    public.set_user_permission_override(UUID, UUID, UUID, BOOLEAN, TEXT)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.set_user_permission_override(UUID, UUID, UUID, BOOLEAN, TEXT)
TO authenticated;


-- ------------------------------------------------------------
-- 2. Remove an override and record the previous decision.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_user_permission_override(
    p_override_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := auth.uid();
    v_override public.user_permission_overrides%ROWTYPE;
BEGIN
    IF v_actor IS NULL
       OR NOT (
            public.current_user_has_role('superadmin')
            OR public.current_user_has_role('church_admin')
       ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_override_id IS NULL
       OR p_reason IS NULL
       OR length(btrim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Override and reason are required';
    END IF;

    SELECT *
    INTO v_override
    FROM public.user_permission_overrides
    WHERE id = p_override_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Permission override not found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        WHERE ur.user_id = v_override.user_id
          AND ur.role_id = 'superadmin'
          AND ur.scope_type = 'global'
    )
    AND NOT public.current_user_has_role('superadmin') THEN
        RAISE EXCEPTION 'Church Admin cannot remove a Superadmin permission override';
    END IF;

    DELETE FROM public.user_permission_overrides
    WHERE id = v_override.id;

    INSERT INTO public.user_permission_override_audit (
        override_id, target_user_id, permission_id, ministry_id,
        operation, old_is_allowed, new_is_allowed,
        actor_user_id, reason
    )
    VALUES (
        v_override.id, v_override.user_id, v_override.permission_id,
        v_override.ministry_id, 'removed', v_override.is_allowed,
        NULL, v_actor, btrim(p_reason)
    );

    RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION
    public.remove_user_permission_override(UUID, TEXT)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.remove_user_permission_override(UUID, TEXT)
TO authenticated;


-- ------------------------------------------------------------
-- 3. Ministry-module read policy.
-- Users with an assignment in a ministry can read its mappings.
-- Approved global Superadmin and Church Admin can read all
-- mappings, including inactive mappings needed for administration.
-- No direct INSERT/UPDATE/DELETE is granted.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS ministry_modules_select_authorized
    ON public.ministry_modules;

CREATE POLICY ministry_modules_select_authorized
ON public.ministry_modules
FOR SELECT
TO authenticated
USING (
    public.current_user_has_role('superadmin')
    OR public.current_user_has_role('church_admin')
    OR public.current_user_has_ministry_assignment(ministry_id)
);

GRANT SELECT ON TABLE public.ministry_modules TO authenticated;

-- Explicitly keep all other new authorization tables inaccessible
-- through direct client table operations.
REVOKE ALL ON TABLE
    public.user_permission_overrides,
    public.user_role_assignment_audit,
    public.user_permission_override_audit,
    public.ministry_module_audit
FROM PUBLIC, anon, authenticated;

COMMIT;

-- ============================================================
-- REVIEW GATES
--
-- 1. Review the override audit operation classification and
--    concurrent upsert behavior before execution.
-- 2. Test that Church Admin cannot create/update/remove an
--    override for a global Superadmin account.
-- 3. Test that ministry-specific overrides cannot be created
--    against global/self permission definitions.
-- 4. Confirm that inactive ministry/mapping overrides do not
--    grant access in has_module_permission().
-- 5. Confirm only ministry_modules SELECT is granted directly.
-- 6. Confirm audit tables remain inaccessible to direct client
--    SELECT/INSERT/UPDATE/DELETE.
-- 7. Review SECURITY DEFINER owner and EXECUTE privileges.
-- ============================================================
