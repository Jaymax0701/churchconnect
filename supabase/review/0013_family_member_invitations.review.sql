-- ChurchConnect: secure household invitations for existing/new account holders
-- REVIEW ONLY. Do not apply until the full migration is reviewed and the
-- target Supabase project is explicitly confirmed.
--
-- Invitation model:
-- * An approved active primary Family Leader invites an email address.
-- * The invitee signs in or registers independently and verifies that email.
-- * The invitee must have an approved account and completed any required
--   minor review before accepting; ages under 12 remain managed-child records.
-- * Acceptance is self-service and uses auth.uid() plus the verified Auth email.
-- * The invitation token is a random UUID, returned once, stored server-side,
--   and never exposed by list/read APIs. It expires after 14 days.
-- * No email is sent by this migration. The Family Leader shares the generated
--   invitation link using their own email/messaging channel.
-- * No passwords, guardian authority, or consent are shared/inferred.

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
     OR to_regprocedure('public.is_primary_family_leader(uuid)') IS NULL
     OR to_regprocedure('public.list_my_household_members()') IS NULL
     OR to_regprocedure('public.update_my_household_details(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Expected household foundation and migration 0012 functions are missing.';
  END IF;

  IF to_regclass('public.family_invitations') IS NOT NULL
     OR to_regprocedure('public.create_family_invitation(text,text,text,text)') IS NOT NULL
     OR to_regprocedure('public.accept_family_invitation(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation objects already exist; inspect before applying.';
  END IF;
END;
$preflight$;

CREATE TABLE public.family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_email text NOT NULL
    CHECK (length(invited_email) BETWEEN 3 AND 254
      AND invited_email = lower(btrim(invited_email))),
  relationship_group text NOT NULL
    CHECK (relationship_group IN ('immediate', 'extended')),
  relationship_to_leader text NOT NULL,
  relationship_description text,
  invitation_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  accepted_by_auth_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_invitation_relationship_consistent CHECK (
    (relationship_group = 'immediate' AND relationship_to_leader IN
      ('spouse', 'father', 'mother', 'son', 'daughter'))
    OR
    (relationship_group = 'extended' AND relationship_to_leader IN (
      'grandfather', 'grandmother', 'grandson', 'granddaughter',
      'brother', 'sister', 'uncle', 'aunt', 'nephew', 'niece', 'cousin',
      'guardian', 'ward', 'other_relative', 'other_household_member'
    ))
  ),
  CONSTRAINT family_invitation_acceptance_consistency CHECK (
    (status = 'accepted' AND accepted_by_auth_user_id IS NOT NULL AND accepted_at IS NOT NULL)
    OR
    (status <> 'accepted' AND accepted_by_auth_user_id IS NULL AND accepted_at IS NULL)
  )
);

CREATE UNIQUE INDEX family_invitations_one_pending_email_per_family
  ON public.family_invitations(family_id, invited_email)
  WHERE status = 'pending';

CREATE INDEX family_invitations_token_status_expiry
  ON public.family_invitations(invitation_token, status, expires_at);

ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.family_invitations FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.family_invitations IS
  'Private invitation records. All reads and writes occur through trusted SECURITY DEFINER RPCs; invitation tokens must not be exposed in list APIs.';

CREATE FUNCTION public.create_family_invitation(
  p_invited_email text,
  p_relationship_group text,
  p_relationship_to_leader text,
  p_relationship_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_family_id uuid;
  v_email text := lower(pg_catalog.btrim(COALESCE(p_invited_email, '')));
  v_invitation public.family_invitations%ROWTYPE;
  v_existing_user_id uuid;
  v_existing_person_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
     OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;

  IF p_relationship_group NOT IN ('immediate', 'extended')
     OR NOT (
       (p_relationship_group = 'immediate' AND p_relationship_to_leader IN
         ('spouse', 'father', 'mother', 'son', 'daughter'))
       OR
       (p_relationship_group = 'extended' AND p_relationship_to_leader IN (
         'grandfather', 'grandmother', 'grandson', 'granddaughter',
         'brother', 'sister', 'uncle', 'aunt', 'nephew', 'niece', 'cousin',
         'guardian', 'ward', 'other_relative', 'other_household_member'
       ))
     )
     OR length(COALESCE(p_relationship_description, '')) > 120 THEN
    RAISE EXCEPTION 'Choose a supported family relationship.' USING ERRCODE = '22023';
  END IF;

  SELECT fm.family_id
    INTO v_family_id
  FROM public.profiles p
  JOIN public.family_members fm ON fm.person_id = p.person_id
  WHERE p.id = v_actor
    AND p.is_approved IS TRUE
    AND fm.status = 'active'
    AND fm.is_primary_leader IS TRUE;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Only an approved active primary Family Leader can invite household members.'
      USING ERRCODE = '42501';
  END IF;

  IF lower(COALESCE((SELECT u.email FROM auth.users u WHERE u.id = v_actor), '')) = v_email THEN
    RAISE EXCEPTION 'You cannot invite your own account.' USING ERRCODE = '22023';
  END IF;

  -- If the email already belongs to an account, prevent invitations that
  -- cannot be accepted because the person is already in an active household.
  SELECT u.id, p.person_id
    INTO v_existing_user_id, v_existing_person_id
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_existing_person_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.person_id = v_existing_person_id AND fm.status IN ('active', 'pending')
  ) THEN
    RAISE EXCEPTION 'This account already has an active or pending household membership.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.family_invitations
  SET status = 'expired', updated_at = now()
  WHERE family_id = v_family_id
    AND invited_email = v_email
    AND status = 'pending'
    AND expires_at <= now();

  IF EXISTS (
    SELECT 1 FROM public.family_invitations fi
    WHERE fi.family_id = v_family_id
      AND fi.invited_email = v_email
      AND fi.status = 'pending'
      AND fi.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'A pending invitation already exists for this email address.'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.family_invitations (
    family_id, invited_email, relationship_group, relationship_to_leader,
    relationship_description, invited_by_auth_user_id
  )
  VALUES (
    v_family_id, v_email, p_relationship_group, p_relationship_to_leader,
    NULLIF(pg_catalog.btrim(COALESCE(p_relationship_description, '')), ''),
    v_actor
  )
  RETURNING * INTO v_invitation;

  INSERT INTO public.family_audit_log (
    family_id, actor_auth_user_id, action, subject_person_id, details
  )
  VALUES (
    v_family_id, v_actor, 'member_invited', NULL,
    jsonb_build_object(
      'invited_email', v_email,
      'relationship_group', p_relationship_group,
      'relationship_to_leader', p_relationship_to_leader,
      'expires_at', v_invitation.expires_at
    )
  );

  RETURN jsonb_build_object(
    'invitation_id', v_invitation.id,
    'token', v_invitation.invitation_token,
    'invited_email', v_invitation.invited_email,
    'expires_at', v_invitation.expires_at
  );
END;
$function$;

CREATE FUNCTION public.list_my_family_invitations()
RETURNS TABLE (
  invitation_id uuid,
  invited_email text,
  relationship_group text,
  relationship_to_leader text,
  relationship_description text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_family_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  SELECT fm.family_id INTO v_family_id
  FROM public.profiles p
  JOIN public.family_members fm ON fm.person_id = p.person_id
  WHERE p.id = v_actor
    AND p.is_approved IS TRUE
    AND fm.status = 'active'
    AND fm.is_primary_leader IS TRUE;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Only the active primary Family Leader can view household invitations.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT fi.id, fi.invited_email, fi.relationship_group,
         fi.relationship_to_leader, fi.relationship_description,
         CASE WHEN fi.status = 'pending' AND fi.expires_at <= now()
              THEN 'expired' ELSE fi.status END,
         fi.expires_at, fi.created_at
  FROM public.family_invitations fi
  WHERE fi.family_id = v_family_id
  ORDER BY fi.created_at DESC
  LIMIT 50;
END;
$function$;

CREATE FUNCTION public.revoke_family_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_family_id uuid;
BEGIN
  IF v_actor IS NULL OR p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and an invitation are required.' USING ERRCODE = '42501';
  END IF;

  SELECT fm.family_id INTO v_family_id
  FROM public.profiles p
  JOIN public.family_members fm ON fm.person_id = p.person_id
  WHERE p.id = v_actor
    AND p.is_approved IS TRUE
    AND fm.status = 'active'
    AND fm.is_primary_leader IS TRUE;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Only the active primary Family Leader can revoke invitations.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.family_invitations
  SET status = 'revoked', updated_at = now()
  WHERE id = p_invitation_id
    AND family_id = v_family_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending invitation not found.' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

CREATE FUNCTION public.accept_family_invitation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_email text;
  v_person_id uuid;
  v_family_id uuid;
  v_family_name text;
  v_invitation public.family_invitations%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Kuching')::date;
  v_dob date;
  v_minor_status text;
  v_email_confirmed_at timestamptz;
BEGIN
  IF v_actor IS NULL OR p_token IS NULL THEN
    RAISE EXCEPTION 'Sign in to accept this invitation.' USING ERRCODE = '42501';
  END IF;

  SELECT lower(u.email), p.person_id, pe.date_of_birth, pe.minor_review_status,
         u.email_confirmed_at
    INTO v_email, v_person_id, v_dob, v_minor_status, v_email_confirmed_at
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  JOIN public.people pe ON pe.id = p.person_id
  WHERE u.id = v_actor;

  IF v_person_id IS NULL THEN
    RAISE EXCEPTION 'Your ChurchConnect person profile is not ready.' USING ERRCODE = '42501';
  END IF;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Verify your email address before accepting this invitation.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_actor AND p.is_approved IS TRUE
  ) THEN
    RAISE EXCEPTION 'Your ChurchConnect account must be approved before joining a household.'
      USING ERRCODE = '42501';
  END IF;

  IF v_dob IS NULL OR v_dob > v_today THEN
    RAISE EXCEPTION 'A valid date of birth is required before joining a household.'
      USING ERRCODE = '42501';
  END IF;

  IF v_dob > (v_today - interval '12 years')::date THEN
    RAISE EXCEPTION 'Children under 12 must be registered as managed family members.'
      USING ERRCODE = '42501';
  END IF;

  IF v_minor_status = 'rejected'
     OR (
       v_dob > (v_today - interval '18 years')::date
       AND v_minor_status <> 'cleared'
     ) THEN
    RAISE EXCEPTION 'Under-18 safeguarding review must be cleared before joining a household.'
      USING ERRCODE = '42501';
  END IF;

  SELECT fi.* INTO v_invitation
  FROM public.family_invitations fi
  WHERE fi.invitation_token = p_token
    AND fi.status = 'pending'
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'This invitation is invalid, already used, or no longer available.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired. Ask your Family Leader to send a new one.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles inviter_profile
    JOIN public.family_members inviter_membership
      ON inviter_membership.person_id = inviter_profile.person_id
    WHERE inviter_profile.id = v_invitation.invited_by_auth_user_id
      AND inviter_profile.is_approved IS TRUE
      AND inviter_membership.family_id = v_invitation.family_id
      AND inviter_membership.status = 'active'
      AND inviter_membership.is_primary_leader IS TRUE
  ) THEN
    RAISE EXCEPTION 'This invitation is no longer valid because the inviting Family Leader is no longer active.'
      USING ERRCODE = '42501';
  END IF;

  IF v_invitation.invited_email <> v_email THEN
    RAISE EXCEPTION 'Sign in with the email address to which this invitation was sent.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.person_id = v_person_id AND fm.status IN ('active', 'pending')
  ) THEN
    RAISE EXCEPTION 'This account already belongs to an active household.'
      USING ERRCODE = '23505';
  END IF;

  v_family_id := v_invitation.family_id;
  SELECT f.family_name INTO v_family_name
  FROM public.families f WHERE f.id = v_family_id;

  INSERT INTO public.family_members (
    family_id, person_id, relationship_group, relationship_to_leader,
    relationship_description, is_primary_leader, status,
    added_by_auth_user_id, joined_at
  )
  VALUES (
    v_family_id, v_person_id, v_invitation.relationship_group,
    v_invitation.relationship_to_leader,
    v_invitation.relationship_description, false, 'active',
    v_invitation.invited_by_auth_user_id, now()
  );

  UPDATE public.family_invitations
  SET status = 'accepted',
      accepted_by_auth_user_id = v_actor,
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_invitation.id;

  INSERT INTO public.family_audit_log (
    family_id, actor_auth_user_id, action, subject_person_id, details
  )
  VALUES (
    v_family_id, v_actor, 'member_joined', v_person_id,
    jsonb_build_object(
      'invitation_id', v_invitation.id,
      'invited_email', v_email,
      'relationship_to_leader', v_invitation.relationship_to_leader
    )
  );

  RETURN jsonb_build_object(
    'family_id', v_family_id,
    'family_name', v_family_name,
    'status', 'active'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_family_invitation(text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_family_invitations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_family_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_family_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family_invitation(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_family_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_family_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_family_invitation(uuid) TO authenticated;

COMMIT;

-- Read-only verification after separately approved manual application.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_family_invitation',
    'list_my_family_invitations',
    'revoke_family_invitation',
    'accept_family_invitation'
  )
ORDER BY p.proname;

-- Expected:
-- * Invitation table has RLS enabled and no direct anon/authenticated table grants.
-- * All four RPCs are SECURITY DEFINER; anon cannot execute; authenticated can.
-- * Invite creation is limited to the approved active primary Family Leader.
-- * The invitation token is only returned once by create_family_invitation.
-- * Acceptance requires the matching verified email, approved account, and
--   cleared safeguarding review; under-12 accounts cannot accept.
-- * Acceptance creates one active household membership and an audit event.
-- * Invitations expire after 14 days and can be revoked by their Family Leader.
