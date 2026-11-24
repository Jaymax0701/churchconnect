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
-- Only active, approved global Superadmin and Church Admin.
-- Church Admin cannot modify overrides for a Superadmin.
-- Actor/target account and authority-row locks serialize concurrent
-- account status and administrator-role revocation against each operation.
-- Target account locking also serializes override changes for that user.
-- Permission scope must match the override context.
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
    v_target_is_superadmin BOOLEAN := FALSE;
    v_override_id UUID;
    v_scope TEXT;
    v_old_is_allowed BOOLEAN;
    v_existing_override BOOLEAN := FALSE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_target_user_id IS NULL
       OR p_permission_id IS NULL
       OR p_is_allowed IS NULL
       OR p_reason IS NULL
       OR length(btrim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Target, permission, decision and reason are required';
    END IF;

    IF p_target_user_id = v_actor THEN
        RAISE EXCEPTION 'Administrators cannot modify their own permission overrides';
    END IF;

    -- Lock actor and target accounts in deterministic UUID order.
    -- This matches the ministry-assignment workflow lock order and
    -- serializes account/profile status changes against this operation.
    PERFORM au.id
    FROM auth.users AS au
    WHERE au.id IN (v_actor, p_target_user_id)
    ORDER BY au.id
    FOR UPDATE;

    IF NOT EXISTS (
        SELECT 1
        FROM auth.users AS au
        WHERE au.id = p_target_user_id
    ) THEN
        RAISE EXCEPTION 'Target account not found';
    END IF;

    PERFORM pr.id
    FROM public.profiles AS pr
    WHERE pr.id IN (v_actor, p_target_user_id)
    ORDER BY pr.id
    FOR UPDATE;

    -- Revalidate the actor only after the account/profile locks are held.
    IF NOT public.current_user_is_active_approved() THEN
        RAISE EXCEPTION 'Active approved account required';
    END IF;

    -- Lock the actor's qualifying global authority rows before relying
    -- on them, so concurrent role removal waits until this transaction ends.
    PERFORM ur.id
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_actor
      AND ur.scope_type = 'global'
      AND ur.role_id IN ('superadmin', 'church_admin')
    ORDER BY ur.role_id
    FOR SHARE;

    IF NOT (
        public.current_user_has_role('superadmin')
        OR public.current_user_has_role('church_admin')
    ) THEN
        RAISE EXCEPTION 'Not authorized';
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

    -- Protect the target Superadmin check from concurrent removal.
    PERFORM ur.id
    FROM public.user_roles AS ur
    WHERE ur.user_id = p_target_user_id
      AND ur.role_id = 'superadmin'
      AND ur.scope_type = 'global'
    FOR SHARE;

    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        WHERE ur.user_id = p_target_user_id
          AND ur.role_id = 'superadmin'
          AND ur.scope_type = 'global'
    )
    INTO v_target_is_superadmin;

    IF v_target_is_superadmin
       AND NOT public.current_user_has_role('superadmin') THEN
        RAISE EXCEPTION 'Church Admin cannot modify a Superadmin permission override';
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
        SELECT uo.id, uo.is_allowed
        INTO v_override_id, v_old_is_allowed
        FROM public.user_permission_overrides AS uo
        WHERE uo.user_id = p_target_user_id
          AND uo.permission_id = p_permission_id
          AND uo.ministry_id IS NULL
        FOR UPDATE;
    ELSE
        SELECT uo.id, uo.is_allowed
        INTO v_override_id, v_old_is_allowed
        FROM public.user_permission_overrides AS uo
        WHERE uo.user_id = p_target_user_id
          AND uo.permission_id = p_permission_id
          AND uo.ministry_id = p_ministry_id
        FOR UPDATE;
    END IF;

    v_existing_override := FOUND;

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
        RETURNING id INTO v_override_id;
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
        RETURNING id INTO v_override_id;
    END IF;

    INSERT INTO public.user_permission_override_audit (
        override_id, target_user_id, permission_id, ministry_id,
        operation, old_is_allowed, new_is_allowed,
        actor_user_id, reason
    )
    VALUES (
        v_override_id,
        p_target_user_id,
        p_permission_id,
        p_ministry_id,
        CASE WHEN v_existing_override THEN 'updated' ELSE 'created' END,
        CASE WHEN v_existing_override THEN v_old_is_allowed ELSE NULL END,
        p_is_allowed,
        v_actor,
        btrim(p_reason)
    );

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
    v_target_user_id UUID;
    v_override public.user_permission_overrides%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_override_id IS NULL
       OR p_reason IS NULL
       OR length(btrim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Override and reason are required';
    END IF;

    -- Lock target account first, matching the set workflow's
    -- lock order and preventing races with concurrent upserts.
    SELECT user_id
    INTO v_target_user_id
    FROM public.user_permission_overrides
    WHERE id = p_override_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Permission override not found';
    END IF;

    -- Match the set workflow: lock actor and target accounts in
    -- deterministic UUID order, then their profile rows.
    PERFORM au.id
    FROM auth.users AS au
    WHERE au.id IN (v_actor, v_target_user_id)
    ORDER BY au.id
    FOR UPDATE;

    PERFORM pr.id
    FROM public.profiles AS pr
    WHERE pr.id IN (v_actor, v_target_user_id)
    ORDER BY pr.id
    FOR UPDATE;

    IF NOT public.current_user_is_active_approved() THEN
        RAISE EXCEPTION 'Active approved account required';
    END IF;

    -- Hold qualifying global authority rows while the override is removed.
    PERFORM ur.id
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_actor
      AND ur.scope_type = 'global'
      AND ur.role_id IN ('superadmin', 'church_admin')
    ORDER BY ur.role_id
    FOR SHARE;

    IF NOT (
        public.current_user_has_role('superadmin')
        OR public.current_user_has_role('church_admin')
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT *
    INTO v_override
    FROM public.user_permission_overrides
    WHERE id = p_override_id
      AND user_id = v_target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Permission override no longer exists';
    END IF;

    IF v_override.user_id = v_actor THEN
        RAISE EXCEPTION 'Administrators cannot modify their own permission overrides';
    END IF;

    -- Stabilize the target's Superadmin assignment while applying
    -- the Church Admin restriction.
    PERFORM ur.id
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_override.user_id
      AND ur.role_id = 'superadmin'
      AND ur.scope_type = 'global'
    FOR SHARE;

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
    public.current_user_is_active_approved()
    AND (
        public.current_user_has_role('superadmin')
        OR public.current_user_has_role('church_admin')
        OR public.current_user_has_ministry_assignment(ministry_id)
    )
);

GRANT SELECT ON TABLE public.ministry_modules TO authenticated;

-- ------------------------------------------------------------
-- 4. Restricted audit visibility.
-- Only active, approved global Superadmin and Church Admin can
-- read authorization audit history. Church Admin sees ministry
-- role-assignment events only; global role assignment history
-- remains Superadmin-only. No direct write privileges are given.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS user_role_assignment_audit_admin_select
    ON public.user_role_assignment_audit;
CREATE POLICY user_role_assignment_audit_admin_select
ON public.user_role_assignment_audit
FOR SELECT
TO authenticated
USING (
    public.current_user_is_active_approved()
    AND (
        public.current_user_has_role('superadmin')
        OR (
            public.current_user_has_role('church_admin')
            AND scope_type = 'ministry'
        )
    )
);

DROP POLICY IF EXISTS user_permission_override_audit_admin_select
    ON public.user_permission_override_audit;
CREATE POLICY user_permission_override_audit_admin_select
ON public.user_permission_override_audit
FOR SELECT
TO authenticated
USING (
    public.current_user_is_active_approved()
    AND (
        public.current_user_has_role('superadmin')
        OR public.current_user_has_role('church_admin')
    )
);

DROP POLICY IF EXISTS ministry_module_audit_admin_select
    ON public.ministry_module_audit;
CREATE POLICY ministry_module_audit_admin_select
ON public.ministry_module_audit
FOR SELECT
TO authenticated
USING (
    public.current_user_is_active_approved()
    AND (
        public.current_user_has_role('superadmin')
        OR public.current_user_has_role('church_admin')
    )
);

-- ------------------------------------------------------------
-- 4. Enforce append-only audit history.
-- UPDATE and DELETE are rejected even for privileged API roles.
-- Direct table privileges are separately revoked below.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_authorization_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    RAISE EXCEPTION 'Authorization audit records are append-only';
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_authorization_audit_mutation()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_role_assignment_audit_append_only
    ON public.user_role_assignment_audit;
CREATE TRIGGER user_role_assignment_audit_append_only
BEFORE UPDATE OR DELETE ON public.user_role_assignment_audit
FOR EACH ROW EXECUTE FUNCTION public.prevent_authorization_audit_mutation();

DROP TRIGGER IF EXISTS user_permission_override_audit_append_only
    ON public.user_permission_override_audit;
CREATE TRIGGER user_permission_override_audit_append_only
BEFORE UPDATE OR DELETE ON public.user_permission_override_audit
FOR EACH ROW EXECUTE FUNCTION public.prevent_authorization_audit_mutation();

DROP TRIGGER IF EXISTS ministry_module_audit_append_only
    ON public.ministry_module_audit;
CREATE TRIGGER ministry_module_audit_append_only
BEFORE UPDATE OR DELETE ON public.ministry_module_audit
FOR EACH ROW EXECUTE FUNCTION public.prevent_authorization_audit_mutation();


-- Explicitly keep all other new authorization tables inaccessible
-- through direct client table operations.
REVOKE ALL ON TABLE
    public.user_permission_overrides,
    public.user_role_assignment_audit,
    public.user_permission_override_audit,
    public.ministry_module_audit
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    public.user_role_assignment_audit,
    public.user_permission_override_audit,
    public.ministry_module_audit
TO authenticated;

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
