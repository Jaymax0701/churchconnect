-- ChurchConnect: person identity and family household foundation
-- REVIEW ONLY. Apply manually only after the complete script and preflight
-- assumptions have been checked against the intended Supabase project.
--
-- Apply this file BEFORE 0009_pdpa_dob_consent_and_minor_review.review.sql.
-- It is additive: existing Auth accounts are backfilled to person records.
-- No family registration UI or write API is enabled by this script. Trusted
-- server-side family workflows must be implemented and reviewed separately.
--
-- Core rule: a person record is independent of a Supabase Auth account.
-- Children under 12 can therefore exist as people/family members with no login.
-- Never create placeholder Auth users or shared passwords for managed children.

BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run this reviewed operation as the trusted postgres database role.';
  END IF;

  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.congregation_memberships') IS NULL
     OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Expected profiles, congregation_memberships, and auth.users tables.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'person_id'
  ) OR to_regclass('public.people') IS NOT NULL
    OR to_regclass('public.families') IS NOT NULL
    OR to_regclass('public.family_members') IS NOT NULL
    OR to_regclass('public.family_change_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'Family/person objects already exist or are partially deployed; inspect and reconcile before running.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.congregation_memberships AS cm
    LEFT JOIN public.profiles AS p ON p.id = cm.user_id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every existing congregation membership must map to a profile before person backfill.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.profiles'::regclass AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.congregation_memberships'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS must already be enabled on profiles and congregation_memberships.';
  END IF;
END;
$preflight$;

-- Durable person identity. auth_user_id is nullable by design.
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text,
  date_of_birth date,
  minor_review_status text NOT NULL DEFAULT 'not_required'
    CHECK (minor_review_status IN ('not_required', 'pending_review', 'cleared', 'rejected')),
  minor_reviewed_at timestamptz,
  minor_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.people IS
  'Durable person identity independent of authentication. Children under 12 may have a person record without an Auth account.';
COMMENT ON COLUMN public.people.auth_user_id IS
  'Nullable one-to-one link to Supabase Auth. NULL means this person has no individual login account.';
COMMENT ON COLUMN public.people.minor_review_status IS
  'Safeguarding/guardian review state for the person, independent of login-account approval. A cleared marker is not proof of legal guardian authority.';

-- Link current account profiles to their durable person record.
ALTER TABLE public.profiles
  ADD COLUMN person_id uuid;

INSERT INTO public.people (auth_user_id, full_name, created_at, updated_at)
SELECT p.id, p.full_name, COALESCE(p.created_at, now()), COALESCE(p.updated_at, now())
FROM public.profiles AS p
ON CONFLICT (auth_user_id) DO NOTHING;

UPDATE public.profiles AS p
SET person_id = pe.id
FROM public.people AS pe
WHERE pe.auth_user_id = p.id
  AND p.person_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN person_id SET NOT NULL,
  ADD CONSTRAINT profiles_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX profiles_person_id_unique ON public.profiles(person_id);

-- One household may contain immediate family by default and optional extended
-- family. In-law relationships are explicit optional extended relationships,
-- never an automatic reason to place someone in a household.
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name text NOT NULL CHECK (length(btrim(family_name)) BETWEEN 1 AND 160),
  household_address text,
  shared_contact_phone text,
  created_by_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  created_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  relationship_group text NOT NULL
    CHECK (relationship_group IN ('immediate', 'extended')),
  relationship_to_leader text NOT NULL
    CHECK (relationship_to_leader IN (
      'family_leader',
      'spouse', 'father', 'mother', 'son', 'daughter',
      'grandfather', 'grandmother', 'grandson', 'granddaughter',
      'brother', 'sister', 'uncle', 'aunt', 'nephew', 'niece', 'cousin',
      'father_in_law', 'mother_in_law', 'son_in_law', 'daughter_in_law',
      'brother_in_law', 'sister_in_law',
      'guardian', 'ward', 'other_relative', 'other_household_member'
    )),
  relationship_description text,
  is_primary_leader boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'rejected', 'removed')),
  added_by_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_members_family_person_unique UNIQUE (family_id, person_id),
  CONSTRAINT family_leader_relationship_consistent CHECK (
    (is_primary_leader AND relationship_to_leader = 'family_leader'
      AND relationship_group = 'immediate')
    OR
    (NOT is_primary_leader AND relationship_to_leader <> 'family_leader')
  ),
  CONSTRAINT family_relationship_group_consistent CHECK (
    (relationship_group = 'immediate' AND relationship_to_leader IN
      ('family_leader', 'spouse', 'father', 'mother', 'son', 'daughter'))
    OR
    (relationship_group = 'extended' AND relationship_to_leader IN (
      'grandfather', 'grandmother', 'grandson', 'granddaughter',
      'brother', 'sister', 'uncle', 'aunt', 'nephew', 'niece', 'cousin',
      'father_in_law', 'mother_in_law', 'son_in_law', 'daughter_in_law',
      'brother_in_law', 'sister_in_law', 'guardian', 'ward',
      'other_relative', 'other_household_member'
    ))
  )
);

-- Initial release: a person may belong to only one active household.
-- This can be relaxed later for split-household/custody arrangements.
CREATE UNIQUE INDEX family_members_one_active_household_per_person
  ON public.family_members(person_id)
  WHERE status = 'active';

-- At most one active primary leader per household. Family-creation and
-- leader-transfer RPCs must guarantee that each active family has one.
CREATE UNIQUE INDEX family_members_one_active_leader_per_family
  ON public.family_members(family_id)
  WHERE is_primary_leader = true AND status = 'active';

CREATE TABLE public.family_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  target_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  requested_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  proposed_values jsonb NOT NULL
    CHECK (jsonb_typeof(proposed_values) = 'object'
      AND proposed_values <> '{}'::jsonb),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_change_review_consistency CHECK (
    (status IN ('pending', 'cancelled')
      AND reviewed_by_auth_user_id IS NULL AND reviewed_at IS NULL)
    OR
    (status IN ('approved', 'rejected')
      AND reviewed_by_auth_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.family_change_requests IS
  'Pending personal-detail proposals. Current values must not change until a trusted Family Leader approval workflow accepts the request.';

-- Extend the existing Auth-linked congregation membership to person identity.
-- Keep user_id for current application compatibility; NULL is allowed for a
-- managed child who has no login. Every membership must identify a person.
ALTER TABLE public.congregation_memberships
  ADD COLUMN person_id uuid;

UPDATE public.congregation_memberships AS cm
SET person_id = p.person_id
FROM public.profiles AS p
WHERE p.id = cm.user_id
  AND cm.person_id IS NULL;

DO $constraints$
DECLARE
  v_constraint record;
BEGIN
  -- Remove the original single-column UNIQUE constraint on user_id, if present.
  -- A partial unique index below preserves uniqueness for linked Auth accounts.
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.congregation_memberships'::regclass
      AND contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM unnest(conkey) AS key(attnum)
        JOIN pg_attribute a
          ON a.attrelid = conrelid AND a.attnum = key.attnum
      ) = ARRAY['user_id']::name[]
  LOOP
    EXECUTE format('ALTER TABLE public.congregation_memberships DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$constraints$;

ALTER TABLE public.congregation_memberships
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN person_id SET NOT NULL,
  ADD CONSTRAINT congregation_memberships_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE RESTRICT,
  ADD CONSTRAINT congregation_memberships_identity_required
    CHECK (user_id IS NOT NULL OR person_id IS NOT NULL);

CREATE UNIQUE INDEX congregation_memberships_user_id_unique
  ON public.congregation_memberships(user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX congregation_memberships_person_id_unique
  ON public.congregation_memberships(person_id);

-- Enable RLS. Authenticated users can read only their own person row or people
-- who share an active household with them. All writes remain server-side only.
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_change_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.people, public.families, public.family_members,
  public.family_change_requests FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.people, public.families, public.family_members,
  public.family_change_requests TO authenticated;

-- SECURITY DEFINER membership predicates avoid recursive RLS evaluation
-- when a policy needs to check membership in the same protected table.
CREATE OR REPLACE FUNCTION public.is_active_family_member(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.family_members AS fm ON fm.person_id = p.person_id
    WHERE p.id = (SELECT auth.uid())
      AND fm.family_id = target_family_id
      AND fm.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_primary_family_leader(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.family_members AS fm ON fm.person_id = p.person_id
    WHERE p.id = (SELECT auth.uid())
      AND fm.family_id = target_family_id
      AND fm.is_primary_leader = true
      AND fm.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_active_family_leader_of_person(target_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.family_members AS leader ON leader.person_id = p.person_id
    JOIN public.family_members AS target
      ON target.family_id = leader.family_id
    WHERE p.id = (SELECT auth.uid())
      AND leader.is_primary_leader = true
      AND leader.status = 'active'
      AND target.person_id = target_person_id
      AND target.status = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_active_family_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_primary_family_leader(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_family_leader_of_person(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_family_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_primary_family_leader(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_family_leader_of_person(uuid) TO authenticated;

-- A non-leader household member must submit personal-name changes
-- through the Family Leader approval workflow, not update profiles directly.
CREATE OR REPLACE FUNCTION public.can_update_own_profile_name()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.family_members AS fm ON fm.person_id = p.person_id
    WHERE p.id = (SELECT auth.uid())
      AND fm.status = 'active'
      AND fm.is_primary_leader = false
  );
$function$;

REVOKE ALL ON FUNCTION public.can_update_own_profile_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_update_own_profile_name() TO authenticated;

DROP POLICY IF EXISTS profiles_update_own_name ON public.profiles;
CREATE POLICY profiles_update_own_name
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND public.can_update_own_profile_name()
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    AND public.can_update_own_profile_name()
  );

-- Keep the Auth profile display name and durable person name aligned
-- when a self-service update is permitted (no family, or Family Leader).
CREATE OR REPLACE FUNCTION public.sync_profile_name_to_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.people
  SET full_name = NEW.full_name,
      updated_at = now()
  WHERE id = NEW.person_id;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_profile_name_to_person() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_profile_name_to_person ON public.profiles;
CREATE TRIGGER sync_profile_name_to_person
AFTER UPDATE OF full_name ON public.profiles
FOR EACH ROW
WHEN (OLD.full_name IS DISTINCT FROM NEW.full_name)
EXECUTE FUNCTION public.sync_profile_name_to_person();

CREATE POLICY people_select_self_or_family_leader
  ON public.people FOR SELECT TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR public.is_active_family_leader_of_person(id)
  );

CREATE POLICY families_select_active_member_household
  ON public.families FOR SELECT TO authenticated
  USING (public.is_active_family_member(id));

CREATE POLICY family_members_select_same_household
  ON public.family_members FOR SELECT TO authenticated
  USING (public.is_active_family_member(family_id));

CREATE POLICY family_change_requests_select_requester_or_leader
  ON public.family_change_requests FOR SELECT TO authenticated
  USING (
    requested_by_auth_user_id = (SELECT auth.uid())
    OR public.is_primary_family_leader(family_id)
  );

COMMIT;

-- Read-only verification after a separately approved execution.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('people', 'families', 'family_members',
    'family_change_requests', 'profiles', 'congregation_memberships')
ORDER BY table_name, ordinal_position;

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', format('public.%I', c.relname), 'SELECT') AS anon_can_select,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'SELECT') AS authenticated_can_select,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'INSERT') AS authenticated_can_insert,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'UPDATE') AS authenticated_can_update,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'DELETE') AS authenticated_can_delete
FROM pg_class AS c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('people', 'families', 'family_members', 'family_change_requests')
ORDER BY c.relname;

-- Expected:
-- * Existing profiles have one people row and a non-null profiles.person_id.
-- * Existing congregation memberships are linked to those people rows.
-- * A child person may have people.auth_user_id NULL and no profiles row.
-- * RLS enabled on all four new tables; authenticated SELECT is scoped by policy.
-- * anon has no access; authenticated has no direct INSERT/UPDATE/DELETE.
--
-- NOT YET IMPLEMENTED:
-- * Secure RPC/Edge Function to create a family and its first Family Leader.
-- * Family Leader workflow to add a managed child under 12.
-- * Invitations/join requests for members aged 12+ and adults.
-- * Family Leader approval of personal-detail change requests.
-- * Secure Auth-account linking to an existing person without duplicates.
-- * Minor/guardian consent attribution and safeguarding review.
-- Do not enable family registration UI until these server-side workflows and
-- behavioral RLS tests have been implemented and reviewed.
