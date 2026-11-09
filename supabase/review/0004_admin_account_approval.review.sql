-- ChurchConnect: trusted account-approval operations
-- REVIEW ONLY. This file is intentionally outside supabase/migrations.
-- Apply manually only after reviewing the exact project and confirming the
-- first global superadmin is approved and assigned the canonical role ID
-- 'superadmin'. This does not assign roles or change congregation membership.
--
-- Operations:
-- 1. list_pending_accounts(): exposes only confirmed-email, unapproved accounts
--    to an approved global superadmin.
-- 2. approve_account(target_user_id): approves one other confirmed-email user.
--
-- Approval is recorded in profiles.approved_at / approved_by. Rejection,
-- role assignment, and membership assignment are deliberately out of scope.

BEGIN;

CREATE OR REPLACE FUNCTION public.list_pending_accounts()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  registered_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS actor_profile
    JOIN public.user_roles AS actor_role
      ON actor_role.user_id = actor_profile.id
    WHERE actor_profile.id = actor_id
      AND actor_profile.is_approved IS TRUE
      AND actor_role.role_id = 'superadmin'
      AND actor_role.scope_type = 'global'
      AND actor_role.ministry_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Not authorized to view pending account approvals'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    p.full_name,
    u.created_at
  FROM auth.users AS u
  JOIN public.profiles AS p
    ON p.id = u.id
  WHERE p.is_approved IS FALSE
    AND u.email_confirmed_at IS NOT NULL
  ORDER BY u.created_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  approved_user_id uuid;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS actor_profile
    JOIN public.user_roles AS actor_role
      ON actor_role.user_id = actor_profile.id
    WHERE actor_profile.id = actor_id
      AND actor_profile.is_approved IS TRUE
      AND actor_role.role_id = 'superadmin'
      AND actor_role.scope_type = 'global'
      AND actor_role.ministry_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Not authorized to approve accounts'
      USING ERRCODE = '42501';
  END IF;

  IF target_user_id IS NULL OR target_user_id = actor_id THEN
    RAISE EXCEPTION 'Invalid approval target'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles AS p
  SET
    is_approved = TRUE,
    approved_at = now(),
    approved_by = actor_id,
    updated_at = now()
  WHERE p.id = target_user_id
    AND p.is_approved IS FALSE
    AND EXISTS (
      SELECT 1
      FROM auth.users AS u
      WHERE u.id = p.id
        AND u.email_confirmed_at IS NOT NULL
    )
  RETURNING p.id INTO approved_user_id;

  IF approved_user_id IS NULL THEN
    RAISE EXCEPTION 'Account was not found, is not email-verified, or is no longer pending'
      USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_pending_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_pending_accounts() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_pending_accounts() TO authenticated;

REVOKE ALL ON FUNCTION public.approve_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_account(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_account(uuid) TO authenticated;

COMMIT;

-- Post-application catalog checks:
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('list_pending_accounts', 'approve_account');
--
-- Behavioral verification must be performed through real authenticated
-- sessions: approved global superadmin succeeds; unapproved user/member fails;
-- caller cannot approve self; unverified or already-approved target fails.
-- Do not test destructive privilege changes using the bootstrap account.
