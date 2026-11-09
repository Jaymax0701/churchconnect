-- ChurchConnect: date of birth, under-18 review, and person-linked PDPA consent records
-- REVIEW ONLY. Apply manually after 0008_family_household_foundation.review.sql.
-- This file now records consent against people, not only Auth accounts.
-- Privacy notice version in this draft: 2026-11-v1.
--
-- IMPORTANT BEFORE PUBLIC RELEASE:
-- 1. Replace the legal-entity/contact placeholders in the public privacy notice.
-- 2. Have Malaysian counsel/privacy adviser review the notice and the church's
--    PDPA applicability, including religious-belief/sensitive-data processing.
-- 3. Confirm guardian/safeguarding requirements for under-18 registrations.
-- 4. Confirm actual Supabase/Vercel hosting locations and cross-border safeguards.
--
-- This script does not approve accounts, assign roles, activate memberships,
-- or collect guardian details. Under-18 accounts remain pending review.
-- Existing accounts retain NULL date_of_birth and are not retroactively
-- assigned consent records by this script.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS minor_review_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS minor_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS minor_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_minor_review_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_minor_review_status_check
      CHECK (minor_review_status IN ('not_required', 'pending_review', 'cleared', 'rejected'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.date_of_birth IS
  'Date of birth supplied by the account holder; restricted personal data. Existing accounts may be NULL until collected lawfully.';
COMMENT ON COLUMN public.profiles.minor_review_status IS
  'Under-18 registration review state. pending_review blocks account approval; cleared means an authorized administrator completed the required review, not proof of statutory guardian consent.';

CREATE TABLE IF NOT EXISTS public.privacy_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  consent_actor_type text NOT NULL CHECK (consent_actor_type IN ('self', 'parent_guardian')),
  consenter_relationship text,
  guardian_authority_confirmed boolean NOT NULL DEFAULT false,
  consent_type text NOT NULL CHECK (consent_type IN ('privacy_processing', 'marketing')),
  policy_version text NOT NULL,
  consented boolean NOT NULL,
  notice_language text NOT NULL CHECK (notice_language IN ('en', 'ms')),
  source text NOT NULL DEFAULT 'signup',
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_consent_records_unique_version
    UNIQUE (person_id, consent_type, policy_version),
  CONSTRAINT privacy_consent_records_actor_consistency CHECK (
    (consent_actor_type = 'self' AND user_id IS NOT NULL
      AND recorded_by_auth_user_id = user_id
      AND consenter_relationship IS NULL
      AND guardian_authority_confirmed = false)
    OR
    (consent_actor_type = 'parent_guardian'
      AND consenter_relationship IS NOT NULL
      AND length(btrim(consenter_relationship)) > 0
      AND guardian_authority_confirmed = true)
  )
);

COMMENT ON TABLE public.privacy_consent_records IS
  'Append-only record of privacy acknowledgement/consent choices, notice version, language, source, and timestamp. Do not store passwords, tokens, or unnecessary device/IP data here.';

ALTER TABLE public.privacy_consent_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.privacy_consent_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.privacy_consent_records TO authenticated;

DROP POLICY IF EXISTS privacy_consent_records_select_own
  ON public.privacy_consent_records;
CREATE POLICY privacy_consent_records_select_own
  ON public.privacy_consent_records
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

-- Keep consent history immutable to client roles. Only the trusted Auth trigger
-- (SECURITY DEFINER owner) writes signup records. Later withdrawal/update
-- workflows must use a separately reviewed server-side function.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE public.privacy_consent_records
  FROM PUBLIC, anon, authenticated;

-- Extend the existing Auth profile trigger. The trigger is expected to exist
-- from the reviewed account foundation. Reject registrations that bypass the
-- current mandatory notice/consent fields or submit an invalid DOB.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $profile_fn$
DECLARE
  v_dob date;
  v_notice_version text;
  v_notice_language text;
  v_privacy_consent boolean;
  v_marketing_consent boolean;
  v_person_id uuid;
  v_full_name text;
BEGIN
  v_notice_version := NEW.raw_user_meta_data ->> 'privacy_notice_version';
  v_notice_language := COALESCE(NEW.raw_user_meta_data ->> 'privacy_notice_language', 'en');
  v_privacy_consent := COALESCE((NEW.raw_user_meta_data ->> 'privacy_consent')::boolean, false);
  v_marketing_consent := COALESCE((NEW.raw_user_meta_data ->> 'marketing_consent')::boolean, false);

  IF v_notice_version IS DISTINCT FROM '2026-11-v1'
     OR v_privacy_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'A valid acknowledgement and consent to the current ChurchConnect Privacy Notice is required.'
      USING ERRCODE = '23514';
  END IF;

  IF v_notice_language NOT IN ('en', 'ms') THEN
    RAISE EXCEPTION 'Unsupported Privacy Notice language.'
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_dob := NULLIF(NEW.raw_user_meta_data ->> 'date_of_birth', '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A valid date of birth is required.'
      USING ERRCODE = '22007';
  END;

  IF v_dob IS NULL OR v_dob > CURRENT_DATE THEN
    RAISE EXCEPTION 'A valid date of birth is required.'
      USING ERRCODE = '23514';
  END IF;

  v_full_name := NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), '');

  -- Every authenticated account is linked to one durable person record.
  -- Managed children without login accounts are created by a separate trusted
  -- Family Leader workflow and never receive placeholder Auth users.
  INSERT INTO public.people (auth_user_id, full_name, date_of_birth)
  VALUES (NEW.id, v_full_name, v_dob)
  ON CONFLICT (auth_user_id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id
  RETURNING id INTO v_person_id;

  INSERT INTO public.profiles (
    id, person_id, full_name, is_approved, date_of_birth, minor_review_status
  )
  VALUES (
    NEW.id,
    v_person_id,
    v_full_name,
    false,
    v_dob,
    CASE
      WHEN v_dob > (CURRENT_DATE - INTERVAL '18 years')::date
        THEN 'pending_review'
      ELSE 'not_required'
    END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.privacy_consent_records (
    person_id, user_id, recorded_by_auth_user_id, consent_actor_type,
    consent_type, policy_version, consented, notice_language, source
  )
  VALUES
    (v_person_id, NEW.id, NEW.id, 'self', 'privacy_processing', v_notice_version, true, v_notice_language, 'signup'),
    (v_person_id, NEW.id, NEW.id, 'self', 'marketing', v_notice_version, v_marketing_consent, v_notice_language, 'signup');

  RETURN NEW;
END;
$profile_fn$;

-- Recreate the pending-account listing with the minimum additional information
-- required for an administrator to identify under-18 registrations.
DROP FUNCTION IF EXISTS public.list_pending_accounts();
CREATE FUNCTION public.list_pending_accounts()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  registered_at timestamptz,
  date_of_birth date,
  minor_review_status text
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
    JOIN public.user_roles AS actor_role ON actor_role.user_id = actor_profile.id
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
  SELECT u.id, u.email::text, p.full_name, u.created_at,
         p.date_of_birth, p.minor_review_status
  FROM auth.users AS u
  JOIN public.profiles AS p ON p.id = u.id
  WHERE p.is_approved IS FALSE
    AND u.email_confirmed_at IS NOT NULL
  ORDER BY u.created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_pending_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_pending_accounts() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_pending_accounts() TO authenticated;

-- Only a global approved Superadmin can record the outcome of an under-18
-- review. This is an internal administrative review marker, not a legal
-- determination that parental consent is or is not required.
CREATE OR REPLACE FUNCTION public.review_minor_registration(
  target_user_id uuid,
  review_decision text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  updated_user_id uuid;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS actor_profile
    JOIN public.user_roles AS actor_role ON actor_role.user_id = actor_profile.id
    WHERE actor_profile.id = actor_id
      AND actor_profile.is_approved IS TRUE
      AND actor_role.role_id = 'superadmin'
      AND actor_role.scope_type = 'global'
      AND actor_role.ministry_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Not authorized to review minor registrations'
      USING ERRCODE = '42501';
  END IF;

  IF target_user_id IS NULL OR target_user_id = actor_id
     OR review_decision NOT IN ('cleared', 'rejected') THEN
    RAISE EXCEPTION 'Invalid minor review request'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles AS p
  SET minor_review_status = review_decision,
      minor_reviewed_at = now(),
      minor_reviewed_by = actor_id,
      updated_at = now()
  WHERE p.id = target_user_id
    AND p.is_approved IS FALSE
    AND p.minor_review_status = 'pending_review'
    AND p.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date
  RETURNING p.id INTO updated_user_id;

  IF updated_user_id IS NULL THEN
    RAISE EXCEPTION 'No eligible under-18 account is awaiting review'
      USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_minor_registration(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_minor_registration(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_minor_registration(uuid, text) TO authenticated;

-- Replace approval function so a pending or rejected minor review cannot be
-- bypassed by calling approve_account directly.
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
    JOIN public.user_roles AS actor_role ON actor_role.user_id = actor_profile.id
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
  SET is_approved = TRUE,
      approved_at = now(),
      approved_by = actor_id,
      updated_at = now()
  WHERE p.id = target_user_id
    AND p.is_approved IS FALSE
    AND p.minor_review_status IN ('not_required', 'cleared')
    AND EXISTS (
      SELECT 1 FROM auth.users AS u
      WHERE u.id = p.id AND u.email_confirmed_at IS NOT NULL
    )
  RETURNING p.id INTO approved_user_id;

  IF approved_user_id IS NULL THEN
    RAISE EXCEPTION 'Account is not eligible: verify email and complete any required under-18 review first.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_account(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_account(uuid) TO authenticated;

COMMIT;

-- Verification: columns and constraints
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('date_of_birth', 'minor_review_status', 'minor_reviewed_at', 'minor_reviewed_by')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'privacy_consent_records'
ORDER BY ordinal_position;

SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_auth_user_profile', 'list_pending_accounts', 'review_minor_registration', 'approve_account')
ORDER BY routine_name;

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', 'public.privacy_consent_records', 'SELECT') AS anon_can_select,
  has_table_privilege('authenticated', 'public.privacy_consent_records', 'SELECT') AS authenticated_can_select,
  has_table_privilege('authenticated', 'public.privacy_consent_records', 'INSERT') AS authenticated_can_insert
FROM pg_class c
WHERE c.oid = 'public.privacy_consent_records'::regclass;

-- Expected:
-- * RLS enabled; anon SELECT false; authenticated SELECT true but own rows only;
-- * authenticated INSERT false;
-- * new adult profile status not_required; new under-18 profile pending_review;
-- * every new signup has one person-linked privacy_processing=true and one marketing choice
--   record, both with the exact notice version/language/time;
-- * approve_account fails for pending/rejected minor review and succeeds only
--   after a cleared review plus verified email.
