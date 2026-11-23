-- ============================================================
-- ChurchConnect
-- Review script: 0014_authorization_foundation.review.sql
-- Purpose: Authorization foundation tables
-- Status: MANUAL REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL
--
-- Creates the new ministry-module mapping, user permission
-- override, and audit tables. Existing authorization tables
-- and records are not modified.
--
-- Prerequisites confirmed from owner-supplied live schema:
--   public.ministries(id uuid)
--   public.modules(id text)
--   public.permissions(id uuid)
--   auth.users(id uuid)
--
-- This script does not seed permissions, create RPCs, alter
-- existing RLS policies, or apply itself automatically.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Ministry-to-module mappings
-- ------------------------------------------------------------

CREATE TABLE public.ministry_modules (
    ministry_id UUID NOT NULL,
    module_id TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NULL,

    CONSTRAINT ministry_modules_pkey
        PRIMARY KEY (ministry_id, module_id),

    CONSTRAINT ministry_modules_ministry_id_fkey
        FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id)
        ON DELETE CASCADE,

    CONSTRAINT ministry_modules_module_id_fkey
        FOREIGN KEY (module_id)
        REFERENCES public.modules(id)
        ON DELETE CASCADE,

    CONSTRAINT ministry_modules_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    CONSTRAINT ministry_modules_updated_by_fkey
        FOREIGN KEY (updated_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_ministry_modules_active_module
    ON public.ministry_modules (module_id, ministry_id)
    WHERE is_active = TRUE;

COMMENT ON TABLE public.ministry_modules IS
    'Associates ministries with modules. Deactivation retains the mapping and assignments but suspends ministry-derived access.';


-- ------------------------------------------------------------
-- 2. Individual permission overrides
-- Overrides are permanent until changed or removed by an
-- authorized administrator. Scope consistency and active
-- ministry validation will be enforced by a trusted trigger
-- or RPC in a later review script.
-- ------------------------------------------------------------

CREATE TABLE public.user_permission_overrides (
    id UUID NOT NULL DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    ministry_id UUID NULL,

    is_allowed BOOLEAN NOT NULL,
    reason TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NULL,

    CONSTRAINT user_permission_overrides_pkey
        PRIMARY KEY (id),

    CONSTRAINT user_permission_overrides_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_permission_overrides_permission_id_fkey
        FOREIGN KEY (permission_id)
        REFERENCES public.permissions(id)
        ON DELETE CASCADE,

    CONSTRAINT user_permission_overrides_ministry_id_fkey
        FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id)
        ON DELETE CASCADE,

    CONSTRAINT user_permission_overrides_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    CONSTRAINT user_permission_overrides_updated_by_fkey
        FOREIGN KEY (updated_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    CONSTRAINT user_permission_overrides_reason_check
        CHECK (length(btrim(reason)) > 0)
);

-- A NULL ministry_id represents a non-ministry-specific override.
CREATE UNIQUE INDEX idx_user_permission_overrides_unique_global
    ON public.user_permission_overrides (user_id, permission_id)
    WHERE ministry_id IS NULL;

CREATE UNIQUE INDEX idx_user_permission_overrides_unique_ministry
    ON public.user_permission_overrides (
        user_id,
        permission_id,
        ministry_id
    )
    WHERE ministry_id IS NOT NULL;

CREATE INDEX idx_user_permission_overrides_user
    ON public.user_permission_overrides (user_id);

CREATE INDEX idx_user_permission_overrides_permission
    ON public.user_permission_overrides (permission_id);

COMMENT ON TABLE public.user_permission_overrides IS
    'Administrator-managed per-user permission decisions. Overrides remain effective until changed or removed; ministry scope is validated by trusted database logic.';


-- ------------------------------------------------------------
-- 3. Role assignment audit
-- Historical identifiers intentionally have no foreign keys.
-- This preserves audit history after a user, role, ministry,
-- or assignment is deleted. The actor ID is also retained as
-- a historical identifier rather than set to NULL.
-- ------------------------------------------------------------

CREATE TABLE public.user_role_assignment_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid(),

    target_user_id UUID NOT NULL,
    role_id TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    ministry_id UUID NULL,

    operation TEXT NOT NULL,
    actor_user_id UUID NULL,
    reason TEXT NOT NULL,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_role_assignment_audit_pkey
        PRIMARY KEY (id),

    CONSTRAINT user_role_assignment_audit_scope_check
        CHECK (
            (scope_type = 'global' AND ministry_id IS NULL)
            OR
            (scope_type = 'ministry' AND ministry_id IS NOT NULL)
        ),

    CONSTRAINT user_role_assignment_audit_operation_check
        CHECK (operation IN ('assigned', 'removed')),

    CONSTRAINT user_role_assignment_audit_reason_check
        CHECK (length(btrim(reason)) > 0)
);

CREATE INDEX idx_role_assignment_audit_target_user
    ON public.user_role_assignment_audit (
        target_user_id,
        occurred_at DESC
    );

CREATE INDEX idx_role_assignment_audit_ministry
    ON public.user_role_assignment_audit (
        ministry_id,
        occurred_at DESC
    )
    WHERE ministry_id IS NOT NULL;

CREATE INDEX idx_role_assignment_audit_actor
    ON public.user_role_assignment_audit (
        actor_user_id,
        occurred_at DESC
    );

COMMENT ON TABLE public.user_role_assignment_audit IS
    'Append-only historical record of role assignment and removal events. Historical user, role, ministry, and actor identifiers are intentionally not foreign keys.';


-- ------------------------------------------------------------
-- 4. Permission override audit
-- Historical identifiers intentionally have no foreign keys.
-- State checks ensure created/updated/removed events contain
-- the appropriate old and new allow/deny values.
-- ------------------------------------------------------------

CREATE TABLE public.user_permission_override_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid(),

    override_id UUID NOT NULL,
    target_user_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    ministry_id UUID NULL,

    operation TEXT NOT NULL,
    old_is_allowed BOOLEAN NULL,
    new_is_allowed BOOLEAN NULL,

    actor_user_id UUID NULL,
    reason TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_permission_override_audit_pkey
        PRIMARY KEY (id),

    CONSTRAINT user_permission_override_audit_operation_check
        CHECK (operation IN ('created', 'updated', 'removed')),

    CONSTRAINT user_permission_override_audit_state_check
        CHECK (
            (
                operation = 'created'
                AND old_is_allowed IS NULL
                AND new_is_allowed IS NOT NULL
            )
            OR
            (
                operation = 'updated'
                AND old_is_allowed IS NOT NULL
                AND new_is_allowed IS NOT NULL
            )
            OR
            (
                operation = 'removed'
                AND old_is_allowed IS NOT NULL
                AND new_is_allowed IS NULL
            )
        ),

    CONSTRAINT user_permission_override_audit_reason_check
        CHECK (length(btrim(reason)) > 0)
);

CREATE INDEX idx_override_audit_target_user
    ON public.user_permission_override_audit (
        target_user_id,
        occurred_at DESC
    );

CREATE INDEX idx_override_audit_override
    ON public.user_permission_override_audit (
        override_id,
        occurred_at DESC
    );

CREATE INDEX idx_override_audit_actor
    ON public.user_permission_override_audit (
        actor_user_id,
        occurred_at DESC
    );

COMMENT ON TABLE public.user_permission_override_audit IS
    'Append-only historical record of individual permission override creation, update, and removal events. Historical identifiers are intentionally not foreign keys.';


-- ------------------------------------------------------------
-- 5. Enable RLS and explicitly remove direct client privileges
-- No client policies are created in this foundation script.
-- Trusted SECURITY DEFINER workflows will be added later.
-- ------------------------------------------------------------

ALTER TABLE public.ministry_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignment_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_override_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.ministry_modules,
    public.user_permission_overrides,
    public.user_role_assignment_audit,
    public.user_permission_override_audit
FROM anon, authenticated;

COMMIT;

-- ============================================================
-- END OF REVIEW SCRIPT
--
-- Expected result after approved execution:
--   4 new tables
--   RLS enabled on all 4 tables
--   No direct anon/authenticated table privileges
--   No existing authorization records changed
--
-- Not covered here:
--   * Permission seeding and role matrix
--   * Scope validation for permission overrides
--   * Trusted assignment and override RPCs
--   * Read policies for ministry mappings
--   * Append-only enforcement for audit tables
--   * Permission evaluator and resource-level RLS
-- ============================================================
