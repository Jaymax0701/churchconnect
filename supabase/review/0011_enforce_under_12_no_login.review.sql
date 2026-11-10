-- ChurchConnect: enforce the under-12 no-login policy at the Auth database boundary
-- REVIEW ONLY. This is a follow-up to the already-applied 0009 DOB/consent
-- foundation. It does not create, delete, approve, or modify any user records.
--
-- Why this is needed:
-- The public signup page blocks under-12 registrations, but the live Auth
-- trigger currently accepts any valid DOB and marks every under-18 person
-- pending_review. A caller bypassing the browser could therefore create an
-- Auth account for a child under 12.
--
-- This migration adds the same age gate to the trusted Auth trigger.
-- Managed children must continue to be created through add_managed_child()
-- without an Auth user, profile, login, or password.
--
-- Apply manually only after reviewing this definition against the live
-- function and confirming the target Supabase project. Do not rerun 0008-0010.

BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run this reviewed operation as the trusted postgres database role.';
  END IF;

  IF to_regprocedure('public.handle_new_auth_user_profile()') IS NULL THEN
    RAISE EXCEPTION 'Expected Auth profile trigger function is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE trigger_schema = 'auth'
      AND event_object_table = 'users'
      AND trigger_name = 'on_auth_user_created_profile'
      AND event_manipulation = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Expected Auth user creation trigger is missing.';
  END IF;

  IF to_regclass('public.people') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.privacy_consent_records') IS NULL THEN
    RAISE EXCEPTION 'Expected person, profile, and consent foundation is missing.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_dob date;
  v_notice_version text;
  v_notice_language text;
  v_privacy_consent boolean;
  v_marketing_consent boolean;
  v_person_id uuid;
  v_full_name text;
  v_today date := (now() AT TIME ZONE 'Asia/Kuching')::date;
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

  IF v_dob IS NULL OR v_dob > v_today THEN
    RAISE EXCEPTION 'A valid date of birth is required.'
      USING ERRCODE = '23514';
  END IF;

  -- Under-12 children must not receive individual Auth accounts. This check
  -- runs inside the Auth user INSERT transaction, so a rejected signup does
  -- not leave an orphaned Auth user or profile.
  IF v_dob > (v_today - INTERVAL '12 years')::date THEN
    RAISE EXCEPTION 'Children under 12 must be registered as managed family members and cannot create individual login accounts.'
      USING ERRCODE = '23514';
  END IF;

  v_full_name := NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), '');

  INSERT INTO public.people (
    auth_user_id, full_name, date_of_birth, minor_review_status
  )
  VALUES (
    NEW.id, v_full_name, v_dob,
    CASE
      WHEN v_dob > (v_today - INTERVAL '18 years')::date
        THEN 'pending_review'
      ELSE 'not_required'
    END
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id
  RETURNING id INTO v_person_id;

  INSERT INTO public.profiles (id, person_id, full_name, is_approved)
  VALUES (NEW.id, v_person_id, v_full_name, false)
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
$function$;

COMMIT;

-- Read-only verification after manual application:
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'handle_new_auth_user_profile';

-- Expected:
-- * The trigger still requires the current privacy notice and privacy consent.
-- * DOB uses Asia/Kuching local date.
-- * An under-12 DOB is rejected before the people/profile/consent inserts.
-- * Ages 12-17 remain eligible to register and receive pending_review.
-- * Adults remain eligible and receive not_required.
-- * Managed children continue to use add_managed_child() and have no Auth login.
