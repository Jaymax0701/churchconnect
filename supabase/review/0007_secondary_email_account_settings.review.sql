-- ChurchConnect: secondary contact email and self-service account settings
-- REVIEW ONLY. Apply manually to the development/staging Supabase project.
-- Secondary addresses are stored as unverified contact details only.
-- They MUST NOT be used for password recovery until a verification workflow is implemented.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS secondary_email text,
  ADD COLUMN IF NOT EXISTS secondary_email_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_secondary_email_lower_unique
  ON public.profiles (lower(secondary_email))
  WHERE secondary_email IS NOT NULL;

-- Extend the privileged account audit action allowlist.
ALTER TABLE public.admin_account_audit
  DROP CONSTRAINT IF EXISTS admin_account_audit_action_check;

ALTER TABLE public.admin_account_audit
  ADD CONSTRAINT admin_account_audit_action_check
  CHECK (action IN ('update_account', 'send_password_reset', 'update_secondary_email'));

-- Recreate because the table-return definition now includes the two secondary-email fields.
DROP FUNCTION IF EXISTS public.list_user_accounts();

CREATE FUNCTION public.list_user_accounts()
RETURNS TABLE (
  user_id uuid,
  email text,
  secondary_email text,
  secondary_email_verified_at timestamptz,
  full_name text,
  is_approved boolean,
  approved_at timestamptz,
  registered_at timestamptz,
  role_assignments text,
  membership_status text,
  member_since date
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
    RAISE EXCEPTION 'Not authorized to view user accounts'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    p.secondary_email,
    p.secondary_email_verified_at,
    p.full_name,
    COALESCE(p.is_approved, FALSE),
    p.approved_at,
    u.created_at,
    role_data.role_assignments,
    cm.status,
    cm.member_since
  FROM auth.users AS u
  LEFT JOIN public.profiles AS p ON p.id = u.id
  LEFT JOIN public.congregation_memberships AS cm ON cm.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT string_agg(
      COALESCE(r.name, ur.role_id) || ' (' || ur.scope_type || ')',
      ', ' ORDER BY r.name, ur.scope_type
    ) AS role_assignments
    FROM public.user_roles AS ur
    LEFT JOIN public.roles AS r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
  ) AS role_data ON TRUE
  ORDER BY u.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_user_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_user_accounts() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_user_accounts() TO authenticated;

COMMIT;

-- Verification:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('secondary_email', 'secondary_email_verified_at')
ORDER BY column_name;

SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'list_user_accounts';

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', 'public.admin_account_audit', 'INSERT') AS anon_can_insert,
  has_table_privilege('authenticated', 'public.admin_account_audit', 'INSERT') AS authenticated_can_insert,
  has_table_privilege('service_role', 'public.admin_account_audit', 'INSERT') AS service_role_can_insert
FROM pg_class c
WHERE c.oid = 'public.admin_account_audit'::regclass;
