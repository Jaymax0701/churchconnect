-- ChurchConnect: Superadmin read-only user account directory
-- REVIEW ONLY. Do not place in supabase/migrations or auto-apply.
-- Apply manually to the designated development/staging Supabase project
-- only after reviewing the function and confirming the expected schema.

BEGIN;

CREATE OR REPLACE FUNCTION public.list_user_accounts()
RETURNS TABLE (
  user_id uuid,
  email text,
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
    p.full_name,
    COALESCE(p.is_approved, FALSE),
    p.approved_at,
    u.created_at,
    role_data.role_assignments,
    cm.status,
    cm.member_since
  FROM auth.users AS u
  LEFT JOIN public.profiles AS p
    ON p.id = u.id
  LEFT JOIN public.congregation_memberships AS cm
    ON cm.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT string_agg(
      COALESCE(r.name, ur.role_id) || ' (' || ur.scope_type || ')',
      ', '
      ORDER BY r.name, ur.scope_type
    ) AS role_assignments
    FROM public.user_roles AS ur
    LEFT JOIN public.roles AS r
      ON r.id = ur.role_id
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
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'list_user_accounts';
--
-- Test with a real authenticated global Superadmin session.
-- An approved ordinary member and anon must be denied.
-- This function is read-only and does not expose password hashes or auth secrets.
