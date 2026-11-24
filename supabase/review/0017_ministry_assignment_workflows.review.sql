-- ============================================================
-- ChurchConnect
-- Review script: 0017_ministry_assignment_workflows.review.sql
-- Purpose: Trusted ministry role assignment/removal and
--          ministry-module activation workflows.
-- Status: MANUAL REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL
--
-- All actors are derived from auth.uid(). Direct browser writes
-- to authorization tables remain prohibited.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Audit trail for ministry-module mapping changes.
-- Historical IDs are intentionally not foreign keys.
-- ------------------------------------------------------------

CREATE TABLE public.ministry_module_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID NOT NULL,
    module_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('activated', 'deactivated')),
    actor_user_id UUID NULL,
    reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ministry_module_audit_ministry
    ON public.ministry_module_audit (ministry_id, occurred_at DESC);

ALTER TABLE public.ministry_module_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ministry_module_audit FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------
-- 2. Assign a ministry leader or volunteer.
--
-- Authority:
--   Superadmin / Church Admin: leader or volunteer.
--   Ministry Leader: volunteer only, in own active ministry.
--
-- Self-assignment is prohibited. Target must be an active,
-- approved account. The assignment and audit insert are atomic.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_ministry_role(
    p_target_user_id UUID,
    p_role_id TEXT,
    p_ministry_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := auth.uid();
    v_assignment_id UUID;
    v_is_global_admin BOOLEAN := FALSE;
    v_is_own_ministry_leader BOOLEAN := FALSE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_target_user_id IS NULL OR p_ministry_id IS NULL THEN
        RAISE EXCEPTION 'Target user and ministry are required';
    END IF;

    IF p_target_user_id = v_actor THEN
        RAISE EXCEPTION 'Self-assignment is not permitted';
    END IF;

    -- Lock actor and target account rows in deterministic UUID order.
    -- This serializes account suspension/deletion/ban and profile
    -- approval changes against the authorization decision.
    PERFORM au.id
    FROM auth.users AS au
    WHERE au.id IN (v_actor, p_target_user_id)
    ORDER BY au.id
    FOR UPDATE;

    PERFORM pr.id
    FROM public.profiles AS pr
    WHERE pr.id IN (v_actor, p_target_user_id)
    ORDER BY pr.id
    FOR UPDATE;

    IF NOT EXISTS (
        SELECT 1
        FROM auth.users AS au
        JOIN public.profiles AS pr ON pr.id = au.id
        WHERE au.id = v_actor
          AND au.deleted_at IS NULL
          AND (au.banned_until IS NULL OR au.banned_until <= NOW())
          AND pr.is_approved IS TRUE
    ) THEN
        RAISE EXCEPTION 'Active approved account required';
    END IF;

    IF p_role_id NOT IN ('ministry_leader', 'ministry_volunteer') THEN
        RAISE EXCEPTION 'Only ministry leader and volunteer roles can be assigned through this workflow';
    END IF;

    IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'A reason is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS pr
        JOIN auth.users AS au ON au.id = pr.id
        WHERE pr.id = p_target_user_id
          AND pr.is_approved IS TRUE
          AND au.deleted_at IS NULL
          AND (au.banned_until IS NULL OR au.banned_until <= NOW())
    ) THEN
        RAISE EXCEPTION 'Target account must be active and approved';
    END IF;

    -- Hold the ministry row stable while its active state authorizes
    -- this assignment. A concurrent deactivation must wait.
    PERFORM mn.id
    FROM public.ministries AS mn
    WHERE mn.id = p_ministry_id
      AND mn.is_active IS TRUE
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ministry does not exist or is inactive';
    END IF;

    -- Lock the actor's global authority rows before evaluating them.
    PERFORM ur.id
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_actor
      AND ur.scope_type = 'global'
      AND ur.role_id IN ('superadmin', 'church_admin')
    FOR SHARE;

    v_is_global_admin :=
        public.current_user_has_role('superadmin')
        OR public.current_user_has_role('church_admin');

    IF NOT v_is_global_admin THEN
        IF p_role_id <> 'ministry_volunteer' THEN
            RAISE EXCEPTION 'Ministry leaders may assign volunteers only';
        END IF;

        -- Lock the qualifying leader assignment so a concurrent
        -- removal cannot revoke delegation mid-operation.
        PERFORM ur.id
        FROM public.user_roles AS ur
        WHERE ur.user_id = v_actor
          AND ur.role_id = 'ministry_leader'
          AND ur.scope_type = 'ministry'
          AND ur.ministry_id = p_ministry_id
        FOR SHARE;

        v_is_own_ministry_leader := FOUND;

        IF NOT v_is_own_ministry_leader THEN
            RAISE EXCEPTION 'Not authorized to manage assignments in this ministry';
        END IF;
    END IF;

    INSERT INTO public.user_roles (
        user_id, role_id, scope_type, ministry_id, assigned_by
    )
    VALUES (
        p_target_user_id, p_role_id, 'ministry', p_ministry_id, v_actor
    )
    RETURNING id INTO v_assignment_id;

    INSERT INTO public.user_role_assignment_audit (
        target_user_id, role_id, scope_type, ministry_id,
        operation, actor_user_id, reason
    )
    VALUES (
        p_target_user_id, p_role_id, 'ministry', p_ministry_id,
        'assigned', v_actor, btrim(p_reason)
    );

    RETURN v_assignment_id;
END;
$function$;

REVOKE ALL ON FUNCTION
    public.assign_ministry_role(UUID, TEXT, UUID, TEXT)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.assign_ministry_role(UUID, TEXT, UUID, TEXT)
TO authenticated;


-- ------------------------------------------------------------
-- 3. Remove a ministry role assignment.
-- Authority mirrors assign_ministry_role.
-- Existing last-global-Superadmin safeguards remain untouched.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_ministry_role(
    p_assignment_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := auth.uid();
    v_assignment public.user_roles%ROWTYPE;
    v_is_global_admin BOOLEAN := FALSE;
    v_is_own_ministry_leader BOOLEAN := FALSE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_assignment_id IS NULL
       OR p_reason IS NULL
       OR length(btrim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Assignment and reason are required';
    END IF;

    -- Read the assignment identifiers first without taking a row lock.
    -- Account and ministry locks are acquired before the assignment
    -- lock to keep a consistent lock order with assign_ministry_role.
    SELECT *
    INTO v_assignment
    FROM public.user_roles
    WHERE id = p_assignment_id
      AND scope_type = 'ministry';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ministry assignment not found';
    END IF;

    IF v_assignment.role_id NOT IN ('ministry_leader', 'ministry_volunteer') THEN
        RAISE EXCEPTION 'This workflow cannot remove the selected role';
    END IF;

    IF v_assignment.user_id = v_actor THEN
        RAISE EXCEPTION 'Self-removal is not permitted through this workflow';
    END IF;

    -- Deterministic account lock order serializes status changes.
    PERFORM au.id
    FROM auth.users AS au
    WHERE au.id IN (v_actor, v_assignment.user_id)
    ORDER BY au.id
    FOR UPDATE;

    PERFORM pr.id
    FROM public.profiles AS pr
    WHERE pr.id IN (v_actor, v_assignment.user_id)
    ORDER BY pr.id
    FOR UPDATE;

    IF NOT EXISTS (
        SELECT 1
        FROM auth.users AS au
        JOIN public.profiles AS pr ON pr.id = au.id
        WHERE au.id = v_actor
          AND au.deleted_at IS NULL
          AND (au.banned_until IS NULL OR au.banned_until <= NOW())
          AND pr.is_approved IS TRUE
    ) THEN
        RAISE EXCEPTION 'Active approved account required';
    END IF;

    -- Serialize ministry deactivation with the delegated authority
    -- check. Global administrators may remove assignments even when
    -- the ministry is inactive, but the ministry row must still exist.
    PERFORM mn.id
    FROM public.ministries AS mn
    WHERE mn.id = v_assignment.ministry_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ministry not found';
    END IF;

    -- Re-read and lock the assignment after acquiring earlier locks;
    -- it may have been removed or changed while locks were awaited.
    SELECT *
    INTO v_assignment
    FROM public.user_roles
    WHERE id = p_assignment_id
      AND scope_type = 'ministry'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ministry assignment no longer exists';
    END IF;

    IF v_assignment.role_id NOT IN ('ministry_leader', 'ministry_volunteer')
       OR v_assignment.user_id = v_actor THEN
        RAISE EXCEPTION 'Assignment is no longer eligible for removal';
    END IF;

    PERFORM ur.id
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_actor
      AND ur.scope_type = 'global'
      AND ur.role_id IN ('superadmin', 'church_admin')
    FOR SHARE;

    v_is_global_admin :=
        public.current_user_has_role('superadmin')
        OR public.current_user_has_role('church_admin');

    IF NOT v_is_global_admin THEN
        IF v_assignment.role_id <> 'ministry_volunteer' THEN
            RAISE EXCEPTION 'Ministry leaders may remove volunteers only';
        END IF;

        -- The ministry row is already locked FOR SHARE above.
        -- Lock the leader assignment to prevent concurrent revocation.
        PERFORM ur.id
        FROM public.user_roles AS ur
        WHERE ur.user_id = v_actor
          AND ur.role_id = 'ministry_leader'
          AND ur.scope_type = 'ministry'
          AND ur.ministry_id = v_assignment.ministry_id
        FOR SHARE;

        v_is_own_ministry_leader := FOUND
            AND EXISTS (
                SELECT 1
                FROM public.ministries AS mn
                WHERE mn.id = v_assignment.ministry_id
                  AND mn.is_active IS TRUE
            );

        IF NOT v_is_own_ministry_leader THEN
            RAISE EXCEPTION 'Not authorized to manage assignments in this ministry';
        END IF;
    END IF;

    DELETE FROM public.user_roles
    WHERE id = v_assignment.id;

    INSERT INTO public.user_role_assignment_audit (
        target_user_id, role_id, scope_type, ministry_id,
        operation, actor_user_id, reason
    )
    VALUES (
        v_assignment.user_id, v_assignment.role_id,
        v_assignment.scope_type, v_assignment.ministry_id,
        'removed', v_actor, btrim(p_reason)
    );

    RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION
    public.remove_ministry_role(UUID, TEXT)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.remove_ministry_role(UUID, TEXT)
TO authenticated;


-- ------------------------------------------------------------
-- 4. Activate/deactivate a ministry-module mapping.
-- Only approved global Superadmin or Church Admin.
-- Mapping history and assignments are retained.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_ministry_module_active(
    p_ministry_id UUID,
    p_module_id TEXT,
    p_is_active BOOLEAN,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor UUID := auth.uid();
    v_old_active BOOLEAN;
BEGIN
    IF v_actor IS NULL
       OR NOT public.current_user_is_active_approved()
       OR NOT (
            public.current_user_has_role('superadmin')
            OR public.current_user_has_role('church_admin')
       ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_ministry_id IS NULL
       OR p_module_id IS NULL
       OR p_is_active IS NULL
       OR p_reason IS NULL
       OR length(btrim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Ministry, module, status and reason are required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.ministries
        WHERE id = p_ministry_id
    ) THEN
        RAISE EXCEPTION 'Ministry not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.modules
        WHERE id = p_module_id
    ) THEN
        RAISE EXCEPTION 'Module not found';
    END IF;

    SELECT is_active
    INTO v_old_active
    FROM public.ministry_modules
    WHERE ministry_id = p_ministry_id
      AND module_id = p_module_id
    FOR UPDATE;

    IF NOT FOUND THEN
        IF p_is_active IS FALSE THEN
            RAISE EXCEPTION 'Cannot deactivate a mapping that does not exist';
        END IF;

        INSERT INTO public.ministry_modules (
            ministry_id, module_id, is_active,
            created_by, updated_by
        )
        VALUES (
            p_ministry_id, p_module_id, TRUE, v_actor, v_actor
        );

        INSERT INTO public.ministry_module_audit (
            ministry_id, module_id, operation, actor_user_id, reason
        )
        VALUES (
            p_ministry_id, p_module_id, 'activated', v_actor, btrim(p_reason)
        );

        RETURN TRUE;
    END IF;

    IF v_old_active IS DISTINCT FROM p_is_active THEN
        UPDATE public.ministry_modules
        SET is_active = p_is_active,
            updated_at = NOW(),
            updated_by = v_actor
        WHERE ministry_id = p_ministry_id
          AND module_id = p_module_id;

        INSERT INTO public.ministry_module_audit (
            ministry_id, module_id, operation, actor_user_id, reason
        )
        VALUES (
            p_ministry_id,
            p_module_id,
            CASE WHEN p_is_active THEN 'activated' ELSE 'deactivated' END,
            v_actor,
            btrim(p_reason)
        );
    END IF;

    RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION
    public.set_ministry_module_active(UUID, TEXT, BOOLEAN, TEXT)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.set_ministry_module_active(UUID, TEXT, BOOLEAN, TEXT)
TO authenticated;

COMMIT;

-- ============================================================
-- REVIEW GATES
--
-- 1. Confirm current_user_has_role() is the verified live
--    approved-global-role gate and is executable by these RPCs.
-- 2. Confirm profiles.id is UUID and equals auth.users.id.
-- 3. Confirm user_roles columns and existing integrity triggers.
-- 4. Confirm duplicate assignment raises a safe unique violation.
--    The existing unique assignment index is relied upon.
-- 5. Confirm leader authority is checked against active ministry
--    membership and that leaders cannot assign/remove leaders.
-- 6. Test simultaneous assignment/removal requests and audit
--    atomicity.
-- 7. Verify the mapping audit is append-only after grants/policies
--    are configured in the next review script.
-- 8. Global administrators can still reactivate mappings.
-- ============================================================
