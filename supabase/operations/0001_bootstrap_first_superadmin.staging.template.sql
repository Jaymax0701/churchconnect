-- ChurchConnect: trusted first-superadmin bootstrap.
-- MANUAL OPERATION TEMPLATE — NOT A MIGRATION; NOT EXECUTED.
-- Use only in the SQL editor for the confirmed churchconnect-staging project,
-- after supabase/migrations/0003_member_approval_and_bootstrap_audit.sql has
-- been reviewed and applied to STAGING.
--
-- Prerequisites:
-- 1) Create the target user through the trusted Supabase Auth/admin process.
-- 2) Independently verify the target identity before entering their auth.users UUID.
-- 3) Fill both values below. Do not use a client-supplied UUID or expose this
--    script to ordinary users. The operator reference is an audit annotation,
--    not cryptographic proof of who ran the SQL.
-- 4) Run once, inspect the inserted rows, and securely retain the execution record.
--
-- This operation aborts if a superadmin assignment or bootstrap audit event
-- already exists. It does not remove or replace existing assignments.

BEGIN;

DO $$
DECLARE
  -- Replace NULL with the verified existing auth.users UUID, e.g.:
  -- v_target_user_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_target_user_id uuid := NULL;

  -- Replace with a meaningful operator/ticket reference before execution.
  v_operator_reference text := 'REPLACE_WITH_OPERATOR_REFERENCE';
  v_reason text := 'Trusted one-time bootstrap of the first approved ChurchConnect superadmin';
  v_user_exists boolean;
BEGIN
  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Set v_target_user_id to the independently verified existing auth.users UUID.';
  END IF;

  IF v_operator_reference IS NULL
     OR length(btrim(v_operator_reference)) = 0
     OR v_operator_reference = 'REPLACE_WITH_OPERATOR_REFERENCE' THEN
    RAISE EXCEPTION 'Set v_operator_reference before running bootstrap.';
  END IF;

  IF to_regclass('public.security_bootstrap_audit') IS NULL THEN
    RAISE EXCEPTION 'Bootstrap audit table is missing; apply and verify the staging schema migration first.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = 'superadmin') THEN
    RAISE EXCEPTION 'Canonical role id superadmin is missing.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = v_target_user_id)
    INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'Target UUID does not match an existing auth.users account.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role_id = 'superadmin') THEN
    RAISE EXCEPTION 'A superadmin role assignment already exists; bootstrap is not allowed.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.security_bootstrap_audit
    WHERE event_type = 'first_superadmin_bootstrap'
  ) THEN
    RAISE EXCEPTION 'The one-time first-superadmin bootstrap has already been recorded.';
  END IF;

  INSERT INTO public.profiles (id, is_approved, approved_at, approved_by)
  VALUES (v_target_user_id, true, now(), NULL)
  ON CONFLICT (id) DO UPDATE
    SET is_approved = true,
        approved_at = now(),
        approved_by = NULL;

  INSERT INTO public.user_roles
    (user_id, role_id, scope_type, ministry_id, assigned_by)
  VALUES
    (v_target_user_id, 'superadmin', 'global', NULL, NULL);

  INSERT INTO public.security_bootstrap_audit
    (event_type, target_user_id, operator_reference, reason)
  VALUES
    ('first_superadmin_bootstrap', v_target_user_id, v_operator_reference, v_reason);
END
$$;

COMMIT;

-- Verify the outcome as the trusted database operator. Do not share personal
-- account data unnecessarily when reporting results.
SELECT ur.user_id, ur.role_id, ur.scope_type, p.is_approved, p.approved_at
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role_id = 'superadmin';

SELECT event_type, target_user_id, operator_reference, reason, created_at
FROM public.security_bootstrap_audit
WHERE event_type = 'first_superadmin_bootstrap';
