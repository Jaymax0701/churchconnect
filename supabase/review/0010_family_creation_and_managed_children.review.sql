-- ChurchConnect: trusted family creation and managed-child workflows
-- REVIEW ONLY. This is an additive migration after the already-applied
-- 0008 family/person foundation and 0009 DOB/consent foundation.
--
-- First release scope:
-- 1. An approved authenticated member creates a household and self-appoints
--    as its initial primary Family Leader in one atomic transaction.
-- 2. The primary Family Leader may add a child under 12 as a person record
--    without creating a Supabase Auth account.
-- 3. Every action is recorded in an append-only family audit table.
--
-- This migration deliberately does NOT claim or record guardian consent.
-- Family Leader appointment does not establish legal guardian authority.
-- A separate guardian-authenticated/verified consent workflow is required.
--
-- It does not implement invitations, nomination, leadership transfer,
-- profile-change approvals, account linking, or Superadmin minor review for
-- managed children. Those remain separate reviewed workflows.

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
     OR to_regclass('public.family_change_requests') IS NULL
     OR to_regprocedure('public.is_primary_family_leader(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected family/person foundation objects are missing.';
  END IF;

  IF to_regclass('public.family_audit_log') IS NOT NULL
     OR to_regprocedure('public.create_family_as_primary_leader(text,text,text)') IS NOT NULL
     OR to_regprocedure('public.add_managed_child(uuid,text,date,text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Family workflow objects already exist; inspect and reconcile before applying.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.families'::regclass AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.family_members'::regclass AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.people'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS must be enabled on people, families, and family_members.';
  END IF;
END;
$preflight$;

CREATE TABLE public.family_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE RESTRICT,
  actor_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN (
    'family_created',
    'managed_child_added',
    'leader_nominated',
    'leader_accepted',
    'leadership_transferred',
    'member_invited',
    'member_joined',
    'member_removed',
    'profile_change_approved',
    'profile_change_rejected',
    'household_details_updated'
  )),
  subject_person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.family_audit_log IS
  'Append-only record of trusted household-management actions. Do not store passwords, tokens, full DOBs, or unnecessary sensitive data.';

ALTER TABLE public.family_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.family_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.family_audit_log TO authenticated;

CREATE POLICY family_audit_log_select_primary_leader
  ON public.family_audit_log
  FOR SELECT TO authenticated
  USING (public.is_primary_family_leader(family_id));

-- Atomic family creation and creator self-appointment. The actor is derived
-- from auth.uid(); the caller cannot nominate a different actor.
CREATE FUNCTION public.create_family_as_primary_leader(
  p_family_name text,
  p_household_address text DEFAULT NULL,
  p_shared_contact_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_person_id uuid;
  v_family_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_family_name IS NULL
     OR length(pg_catalog.btrim(p_family_name)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Enter a family name between 1 and 160 characters.'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.person_id
  INTO v_person_id
  FROM public.profiles AS p
  WHERE p.id = v_actor_id
    AND p.is_approved IS TRUE;

  IF v_person_id IS NULL THEN
    RAISE EXCEPTION 'Only an approved ChurchConnect account can create a family.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.family_members AS fm
    WHERE fm.person_id = v_person_id
      AND fm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'This person already belongs to an active household.'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.families (
    family_name, household_address, shared_contact_phone,
    created_by_person_id, created_by_auth_user_id
  )
  VALUES (
    pg_catalog.btrim(p_family_name),
    NULLIF(pg_catalog.btrim(p_household_address), ''),
    NULLIF(pg_catalog.btrim(p_shared_contact_phone), ''),
    v_person_id, v_actor_id
  )
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_members (
    family_id, person_id, relationship_group, relationship_to_leader,
    is_primary_leader, status, added_by_auth_user_id, joined_at
  )
  VALUES (
    v_family_id, v_person_id, 'immediate', 'family_leader',
    true, 'active', v_actor_id, now()
  );

  INSERT INTO public.family_audit_log (
    family_id, actor_auth_user_id, action, subject_person_id, details
  )
  VALUES (
    v_family_id, v_actor_id, 'family_created', v_person_id,
    jsonb_build_object(
      'family_name', pg_catalog.btrim(p_family_name),
      'initial_leader_self_appointed', true
    )
  );

  RETURN v_family_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_family_as_primary_leader(text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family_as_primary_leader(text,text,text)
  TO authenticated;

-- Add a managed child under 12. This creates only a people/family_members row;
-- it never creates an Auth user, profile, login, password, or church membership.
-- Guardian consent is intentionally not inferred from Family Leader status.
CREATE FUNCTION public.add_managed_child(
  p_family_id uuid,
  p_full_name text,
  p_date_of_birth date,
  p_relationship_group text,
  p_relationship_to_leader text,
  p_relationship_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_person_id uuid;
  v_today date := (now() AT TIME ZONE 'Asia/Kuching')::date;
BEGIN
  IF v_actor_id IS NULL
     OR p_family_id IS NULL
     OR NOT public.is_primary_family_leader(p_family_id) THEN
    RAISE EXCEPTION 'Only the active primary Family Leader can add a managed child.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = v_actor_id AND p.is_approved IS TRUE
  ) THEN
    RAISE EXCEPTION 'An approved account is required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_full_name IS NULL
     OR length(pg_catalog.btrim(p_full_name)) NOT BETWEEN 1 AND 160
     OR p_date_of_birth IS NULL
     OR p_date_of_birth > v_today
     OR p_date_of_birth <= (v_today - INTERVAL '12 years')::date THEN
    RAISE EXCEPTION 'A valid date of birth for a child under 12 and a name are required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_relationship_group NOT IN ('immediate', 'extended')
     OR p_relationship_to_leader NOT IN (
       'son', 'daughter', 'grandson', 'granddaughter', 'ward'
     ) THEN
    RAISE EXCEPTION 'Choose a supported child/ward relationship.'
      USING ERRCODE = '22023';
  END IF;

  IF (p_relationship_group = 'immediate'
      AND p_relationship_to_leader NOT IN ('son', 'daughter'))
     OR (p_relationship_group = 'extended'
      AND p_relationship_to_leader NOT IN ('grandson', 'granddaughter', 'ward')) THEN
    RAISE EXCEPTION 'The selected relationship does not match the relationship group.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.family_members AS fm
    WHERE fm.family_id = p_family_id
      AND fm.status = 'active'
      AND fm.person_id IN (
        SELECT person.id
        FROM public.people AS person
        WHERE person.auth_user_id IS NULL
          AND person.full_name = pg_catalog.btrim(p_full_name)
          AND person.date_of_birth = p_date_of_birth
      )
  ) THEN
    RAISE EXCEPTION 'A matching managed person already exists in this household.'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.people (
    full_name, date_of_birth, minor_review_status, created_by_auth_user_id
  )
  VALUES (
    pg_catalog.btrim(p_full_name), p_date_of_birth,
    'pending_review', v_actor_id
  )
  RETURNING id INTO v_person_id;

  INSERT INTO public.family_members (
    family_id, person_id, relationship_group, relationship_to_leader,
    relationship_description, is_primary_leader, status,
    added_by_auth_user_id, joined_at
  )
  VALUES (
    p_family_id, v_person_id, p_relationship_group,
    p_relationship_to_leader,
    NULLIF(pg_catalog.btrim(p_relationship_description), ''),
    false, 'active', v_actor_id, now()
  );

  INSERT INTO public.family_audit_log (
    family_id, actor_auth_user_id, action, subject_person_id, details
  )
  VALUES (
    p_family_id, v_actor_id, 'managed_child_added', v_person_id,
    jsonb_build_object(
      'relationship_group', p_relationship_group,
      'relationship_to_leader', p_relationship_to_leader,
      'guardian_consent_recorded', false,
      'auth_account_created', false
    )
  );

  RETURN v_person_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_managed_child(uuid,text,date,text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_managed_child(uuid,text,date,text,text,text)
  TO authenticated;

-- Audit history is append-only for client roles. Trusted SECURITY DEFINER
-- functions owned by the migration owner can insert records.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.family_audit_log FROM PUBLIC, anon, authenticated;

COMMIT;

-- Verification
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', format('public.%I', c.relname), 'SELECT') AS anon_can_select,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'SELECT') AS authenticated_can_select,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'INSERT') AS authenticated_can_insert,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'UPDATE') AS authenticated_can_update,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'DELETE') AS authenticated_can_delete
FROM pg_class AS c
WHERE c.oid = 'public.family_audit_log'::regclass;

SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('create_family_as_primary_leader', 'add_managed_child')
ORDER BY routine_name;

-- Expected:
-- * RLS enabled; anon has no SELECT; authenticated SELECT is limited to leaders.
-- * Authenticated has no direct INSERT/UPDATE/DELETE on the audit table.
-- * Both RPCs are SECURITY DEFINER and EXECUTE is granted to authenticated,
--   not anon/PUBLIC.
-- * Family creation atomically creates exactly one active primary leader.
-- * A managed child has no auth_user_id/profile/Auth user, and is under 12.
-- * No guardian consent is claimed or recorded by this workflow.
