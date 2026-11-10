-- ChurchConnect: household roster read model and household detail updates
-- REVIEW ONLY. Additive follow-up to the verified 0008-0011 foundation.
-- Apply manually only after reviewing this file and confirming the target project.

BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run this reviewed operation as the trusted postgres database role.';
  END IF;
  IF to_regclass('public.people') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.families') IS NULL
     OR to_regclass('public.family_members') IS NULL
     OR to_regclass('public.family_audit_log') IS NULL
     OR to_regprocedure('public.is_primary_family_leader(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected family/person foundation objects are missing.';
  END IF;
  IF to_regprocedure('public.list_my_household_members()') IS NOT NULL
     OR to_regprocedure('public.update_my_household_details(text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'One or more household workspace functions already exist; inspect before applying.';
  END IF;
END;
$preflight$;

CREATE FUNCTION public.list_my_household_members()
RETURNS TABLE (
  person_id uuid,
  full_name text,
  date_of_birth date,
  relationship_group text,
  relationship_to_leader text,
  relationship_description text,
  is_primary_leader boolean,
  has_login boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_family_id uuid;
  v_is_leader boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  SELECT fm.family_id, fm.is_primary_leader
    INTO v_family_id, v_is_leader
  FROM public.profiles p
  JOIN public.family_members fm ON fm.person_id = p.person_id
  WHERE p.id = v_actor AND fm.status = 'active'
  LIMIT 2;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'No active household membership was found.' USING ERRCODE = '42501';
  END IF;

  IF (SELECT count(*) FROM public.profiles p
      JOIN public.family_members fm ON fm.person_id = p.person_id
      WHERE p.id = v_actor AND fm.status = 'active') <> 1 THEN
    RAISE EXCEPTION 'Multiple active household memberships require administrator review.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    fm.person_id,
    person.full_name,
    CASE WHEN v_is_leader THEN person.date_of_birth ELSE NULL::date END,
    fm.relationship_group,
    fm.relationship_to_leader,
    fm.relationship_description,
    fm.is_primary_leader,
    (person.auth_user_id IS NOT NULL)
  FROM public.family_members fm
  JOIN public.people person ON person.id = fm.person_id
  WHERE fm.family_id = v_family_id AND fm.status = 'active'
  ORDER BY fm.is_primary_leader DESC, person.full_name ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_household_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_household_members() TO authenticated;

CREATE FUNCTION public.update_my_household_details(
  p_family_name text,
  p_household_address text DEFAULT NULL,
  p_shared_contact_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_family_id uuid;
  v_person_id uuid;
  v_old_name text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  IF p_family_name IS NULL
     OR length(pg_catalog.btrim(p_family_name)) NOT BETWEEN 1 AND 160
     OR length(COALESCE(p_household_address, '')) > 500
     OR length(COALESCE(p_shared_contact_phone, '')) > 40 THEN
    RAISE EXCEPTION 'Enter valid household details.' USING ERRCODE = '22023';
  END IF;

  SELECT p.person_id, fm.family_id, f.family_name
    INTO v_person_id, v_family_id, v_old_name
  FROM public.profiles p
  JOIN public.family_members fm ON fm.person_id = p.person_id
  JOIN public.families f ON f.id = fm.family_id
  WHERE p.id = v_actor
    AND p.is_approved IS TRUE
    AND fm.status = 'active'
    AND fm.is_primary_leader IS TRUE;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Only the active primary Family Leader of an approved account can update household details.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.families
  SET family_name = pg_catalog.btrim(p_family_name),
      household_address = NULLIF(pg_catalog.btrim(COALESCE(p_household_address, '')), ''),
      shared_contact_phone = NULLIF(pg_catalog.btrim(COALESCE(p_shared_contact_phone, '')), ''),
      updated_at = now()
  WHERE id = v_family_id;

  INSERT INTO public.family_audit_log (
    family_id, actor_auth_user_id, action, subject_person_id, details
  )
  VALUES (
    v_family_id, v_actor, 'household_details_updated', v_person_id,
    jsonb_build_object(
      'family_name_changed', v_old_name IS DISTINCT FROM pg_catalog.btrim(p_family_name),
      'household_details_updated', true
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_household_details(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_household_details(text,text,text) TO authenticated;

COMMIT;

-- Read-only verification:
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('list_my_household_members', 'update_my_household_details')
ORDER BY p.proname;

-- Expected:
-- * Both functions are SECURITY DEFINER with search_path = ''.
-- * anon cannot execute; authenticated can execute.
-- * A member sees household names/relationships and login-presence only.
-- * Date of birth is returned only to the active primary Family Leader.
-- * Only an approved active primary Family Leader can update household details.
-- * Every household detail update creates an audit event.
