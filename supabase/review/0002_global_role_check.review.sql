-- ChurchConnect: global role check for protected application routes
-- Review-only SQL. This file is intentionally outside supabase/migrations.
-- Apply manually to the verified production project after review.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role_id = required_role
      AND ur.scope_type = 'global'
      AND ur.ministry_id IS NULL
  );
$function$;

REVOKE ALL ON FUNCTION public.current_user_has_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_role(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(text) TO authenticated;

COMMIT;

-- Verification (run after applying):
-- SELECT public.current_user_has_role('superadmin');
-- Expected for the signed-in Superadmin session: true.
-- Run this verification from an authenticated client session, not the SQL Editor,
-- because auth.uid() is NULL in a normal SQL Editor session.
