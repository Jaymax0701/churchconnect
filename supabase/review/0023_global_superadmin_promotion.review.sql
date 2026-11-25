-- ============================================================
-- ChurchConnect
-- Review script: 0023_global_superadmin_promotion.review.sql
-- Purpose: Manually promote an existing active, approved account
--          to the global Superadmin role.
-- Status: MANUAL REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL
--
-- Dependencies:
--   * public.user_roles and public.roles (current live schema)
--   * public.user_role_assignment_audit from review script 0014
--   * last-global-Superadmin protection from the current schema
--
-- This is for a subsequent promotion only. It is NOT a first-admin
-- bootstrap and must not be used to recover a database with no
-- active global Superadmin.
--
-- Before use:
--   1. Replace both UUID placeholders with verified Auth user IDs.
--   2. Actor must be a different, active, approved, email-confirmed
--      global Superadmin.
--   3. Target must be active, approved, and email-confirmed.
--   4. Supply a meaningful reason.
--   5. Confirm 0014 has been approved and applied, and audit table
--      shape/grants/triggers match the reviewed definition.
-- ============================================================

BEGIN;

DO $promotion$
DECLARE
    -- REQUIRED: replace with the existing Superadmin actor's Auth UUID.
    v_actor_user_id UUID :=
        '00000000-0000-0000-0000-000000000000';

    -- REQUIRED: replace with the target user's Auth UUID.
    v_target_user_id UUID :=
        '00000000-0000-0000-0000-000000000000';

    -- REQUIRED: replace with a meaningful, non-empty reason.
    v_reason TEXT :=
        'REPLACE WITH APPROVED PROMOTION REASON';

    v_locked_count INTEGER;
    v_profile_lock_count INTEGER;
    v_superadmin_role_id TEXT;
BEGIN
    -- Reject unedited placeholders and invalid actor/target pairing.
    IF v_actor_user_id =
           '00000000-0000-0000-0000-000000000000'::UUID
       OR v_target_user_id =
           '00000000-0000-0000-0000-000000000000'::UUID
       OR v_actor_user_id = v_target_user_id THEN
        RAISE EXCEPTION
            'Replace the actor and target UUID placeholders with two different Auth user IDs.'
            USING ERRCODE = '22023';
    END IF;

    IF v_reason IS NULL
       OR length(pg_catalog.btrim(v_reason)) = 0
       OR v_reason = 'REPLACE WITH APPROVED PROMOTION REASON' THEN
        RAISE EXCEPTION
            'A meaningful promotion reason is required.'
            USING ERRCODE = '22023';
    END IF;

    -- Confirm the required audit table exists before any mutation.
    IF pg_catalog.to_regclass(
        'public.user_role_assignment_audit'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Required audit table is missing. Apply and verify the approved authorization foundation first.'
            USING ERRCODE = '42P01';
    END IF;

    -- Confirm every audit column used by the INSERT and post-commit
    -- verification query is present, including occurred_at. This check
    -- must happen before mutation because verification runs after COMMIT.
    IF (
        SELECT count(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_role_assignment_audit'
          AND column_name IN (
              'target_user_id',
              'role_id',
              'scope_type',
              'ministry_id',
              'operation',
              'actor_user_id',
              'reason',
              'occurred_at'
          )
    ) <> 8 THEN
        RAISE EXCEPTION
            'Role assignment audit table does not match the reviewed schema.'
            USING ERRCODE = '55000';
    END IF;

    -- Lock actor and target Auth rows in deterministic UUID order.
    -- This matches the account lock convention in review script 0018
    -- and serializes against Auth account deactivation/deletion.
    PERFORM au.id
    FROM auth.users AS au
    WHERE au.id IN (v_actor_user_id, v_target_user_id)
    ORDER BY au.id
    FOR UPDATE;

    GET DIAGNOSTICS v_locked_count = ROW_COUNT;

    IF v_locked_count <> 2 THEN
        RAISE EXCEPTION
            'Both actor and target Auth accounts must exist.'
            USING ERRCODE = 'P0002';
    END IF;

    -- Lock both profiles in the same deterministic order.
    PERFORM pr.id
    FROM public.profiles AS pr
    WHERE pr.id IN (v_actor_user_id, v_target_user_id)
    ORDER BY pr.id
    FOR UPDATE;

    GET DIAGNOSTICS v_profile_lock_count = ROW_COUNT;

    IF v_profile_lock_count <> 2 THEN
        RAISE EXCEPTION
            'Both actor and target profiles must exist.'
            USING ERRCODE = 'P0002';
    END IF;

    -- Lock and validate the actor's global Superadmin assignment.
    -- This precedes the canonical role lock, matching the authority
    -- lock order used by the existing administrator workflows.
    PERFORM ur.id
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_actor_user_id
      AND ur.role_id = 'superadmin'
      AND ur.scope_type = 'global'
      AND ur.ministry_id IS NULL
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Actor is not assigned the global Superadmin role.'
            USING ERRCODE = '42501';
    END IF;

    -- Serialize promotion with the existing last-Superadmin guard,
    -- which locks this canonical role row FOR UPDATE.
    SELECT r.id
    INTO v_superadmin_role_id
    FROM public.roles AS r
    WHERE r.id = 'superadmin'
      AND r.is_system IS TRUE
      AND r.name = 'Superadmin'
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Canonical Superadmin system role is missing or inconsistent.'
            USING ERRCODE = '23514';
    END IF;

    -- Actor must remain active, approved, and email-confirmed while
    -- the account/profile/authority locks are held.
    IF NOT EXISTS (
        SELECT 1
        FROM auth.users AS au
        JOIN public.profiles AS pr ON pr.id = au.id
        WHERE au.id = v_actor_user_id
          AND au.email_confirmed_at IS NOT NULL
          AND au.deleted_at IS NULL
          AND (
              au.banned_until IS NULL
              OR au.banned_until <= statement_timestamp()
          )
          AND pr.is_approved IS TRUE
    ) THEN
        RAISE EXCEPTION
            'Actor must be active, email-confirmed, and approved.'
            USING ERRCODE = '42501';
    END IF;

    -- Target must be an existing active, email-confirmed, approved
    -- account. No approval or Auth account status is changed here.
    IF NOT EXISTS (
        SELECT 1
        FROM auth.users AS au
        JOIN public.profiles AS pr ON pr.id = au.id
        WHERE au.id = v_target_user_id
          AND au.email_confirmed_at IS NOT NULL
          AND au.deleted_at IS NULL
          AND (
              au.banned_until IS NULL
              OR au.banned_until <= statement_timestamp()
          )
          AND pr.is_approved IS TRUE
    ) THEN
        RAISE EXCEPTION
            'Target must be active, email-confirmed, and approved before promotion.'
            USING ERRCODE = '42501';
    END IF;

    -- Do not silently repair, replace, or duplicate any existing
    -- Superadmin assignment for the target, regardless of its scope.
    -- Other legitimate roles (for example, global member) are retained.
    IF EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        WHERE ur.user_id = v_target_user_id
          AND ur.role_id = 'superadmin'
    ) THEN
        RAISE EXCEPTION
            'Target already has a Superadmin assignment. Review it manually; no changes were made.'
            USING ERRCODE = '23505';
    END IF;

    -- Insert the global role and its audit event in this transaction.
    -- ministry_id is explicitly NULL for a global assignment.
    INSERT INTO public.user_roles (
        user_id,
        role_id,
        scope_type,
        ministry_id,
        assigned_by
    )
    VALUES (
        v_target_user_id,
        v_superadmin_role_id,
        'global',
        NULL,
        v_actor_user_id
    );

    INSERT INTO public.user_role_assignment_audit (
        target_user_id,
        role_id,
        scope_type,
        ministry_id,
        operation,
        actor_user_id,
        reason
    )
    VALUES (
        v_target_user_id,
        v_superadmin_role_id,
        'global',
        NULL,
        'assigned',
        v_actor_user_id,
        pg_catalog.btrim(v_reason)
    );
END;
$promotion$;

-- The role assignment and audit insert are committed together.
-- Any exception before this point aborts the transaction.
COMMIT;

-- Verification result sets. These run after the committed transaction.
SELECT
    ur.id AS assignment_id,
    ur.user_id,
    ur.role_id,
    ur.scope_type,
    ur.ministry_id,
    ur.assigned_by,
    ur.created_at,
    p.is_approved,
    au.email_confirmed_at,
    au.deleted_at,
    au.banned_until
FROM public.user_roles AS ur
JOIN public.profiles AS p ON p.id = ur.user_id
JOIN auth.users AS au ON au.id = ur.user_id
WHERE ur.role_id = 'superadmin'
  AND ur.scope_type = 'global'
  AND ur.ministry_id IS NULL
ORDER BY ur.created_at;

SELECT
    target_user_id,
    role_id,
    scope_type,
    ministry_id,
    operation,
    actor_user_id,
    reason,
    occurred_at
FROM public.user_role_assignment_audit
WHERE role_id = 'superadmin'
  AND scope_type = 'global'
  AND operation = 'assigned'
ORDER BY occurred_at DESC
LIMIT 20;

-- IMPORTANT:
-- This script is manual-review only and must not be executed until
-- separately approved. Once approved, the assignment and audit row
-- commit atomically. If any validation or insert fails, the transaction
-- aborts and neither change is committed.
-- ============================================================
