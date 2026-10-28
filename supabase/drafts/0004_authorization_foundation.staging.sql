-- ChurchConnect authorization foundation
-- REVIEW DRAFT ONLY. Stored outside supabase/migrations intentionally.
-- STAGING ONLY after review. Do NOT apply to production.
--
-- This draft deliberately grants no CRUD access on authorization tables.
-- The role/module/action matrix is still pending owner approval. Protected
-- tables therefore remain unavailable to anon/authenticated until later,
-- reviewed policies and least-privilege grants are authored together.
--
-- Expected prerequisites:
-- - staging project ref: aibstkdijaruvtvqaxke
-- - migrations 0001/0002 reviewed and their postconditions checked
-- - approval schema/bootstrap already verified in staging
-- - canonical roles and modules match the fail-fast checks below

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.ministries') IS NULL
     OR to_regclass('public.modules') IS NULL
     OR to_regclass('public.roles') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.user_roles') IS NULL
     OR to_regclass('public.security_bootstrap_audit') IS NULL THEN
    RAISE EXCEPTION 'Required ChurchConnect staging objects are missing; aborting.';
  END IF;

  -- Resolve the bootstrap identity from the restricted one-time audit row,
  -- rather than baking a personal account UUID into the reusable draft.
  IF NOT EXISTS (
    SELECT 1
    FROM public.security_bootstrap_audit a
    JOIN public.profiles p ON p.id = a.target_user_id
    WHERE a.event_type = 'first_superadmin_bootstrap'
      AND p.is_approved IS TRUE
  ) THEN
    RAISE EXCEPTION 'Verified staging bootstrap audit/profile is missing or not approved; aborting.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.security_bootstrap_audit a
    JOIN public.user_roles ur ON ur.user_id = a.target_user_id
    WHERE a.event_type = 'first_superadmin_bootstrap'
      AND ur.role_id = 'superadmin'
      AND ur.scope_type = 'global'
      AND ur.ministry_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Verified global staging superadmin assignment is missing; aborting.';
  END IF;

  IF (SELECT count(*) FROM public.roles) <> 6
     OR EXISTS (
       SELECT 1 FROM (VALUES
         ('superadmin'), ('church_admin'), ('church_council'),
         ('ministry_leader'), ('ministry_volunteer'), ('member')
       ) AS expected(id)
       WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id = expected.id)
     ) THEN
    RAISE EXCEPTION 'Canonical role inventory differs from the reviewed staging schema; aborting.';
  END IF;

  IF (SELECT count(*) FROM public.modules) <> 12
     OR EXISTS (
       SELECT 1 FROM (VALUES
         ('cell_groups'), ('children'), ('cms'), ('congregation'),
         ('evangelism'), ('member_portal'), ('men'), ('praise_worship'),
         ('public_site'), ('sunday_service'), ('women'), ('youth')
       ) AS expected(id)
       WHERE NOT EXISTS (SELECT 1 FROM public.modules m WHERE m.id = expected.id)
     ) THEN
    RAISE EXCEPTION 'Canonical module inventory differs from the reviewed staging schema; aborting.';
  END IF;

  IF to_regclass('public.role_module_permissions') IS NOT NULL
     OR to_regclass('public.user_module_permissions') IS NOT NULL THEN
    RAISE EXCEPTION 'Proposed permission tables already exist; reconcile before applying this draft.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ministries'
      AND column_name = 'leader_id'
  ) THEN
    RAISE EXCEPTION 'ministries.leader_id already exists; reconcile before applying this draft.';
  END IF;
END;
$preflight$;

-- The agreed ministry model: one primary leader plus optional additional
-- ministry_leader assignments in user_roles. This column alone grants nothing.
ALTER TABLE public.ministries
  ADD COLUMN leader_id uuid NULL
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX ministries_leader_id_idx
  ON public.ministries (leader_id);

COMMENT ON COLUMN public.ministries.leader_id IS
  'Primary ministry leader only. Leadership access additionally requires a matching ministry-scoped ministry_leader user_roles assignment and an approved active account.';

-- Capability baseline: missing rows mean no role-derived capability.
CREATE TABLE public.role_module_permissions (
  role_id text NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module_id text NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, module_id)
);

COMMENT ON TABLE public.role_module_permissions IS
  'Role capability baseline. No rows are seeded by this draft; owner-approved matrix required before grants are inserted.';

-- Explicit per-user overrides. NULL = inherit role baseline; FALSE = explicit
-- deny; TRUE = explicit capability grant. Other authorization constraints
-- (approval, active module, row scope, ownership) must still be enforced.
CREATE TABLE public.user_module_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id text NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  can_view boolean NULL,
  can_create boolean NULL,
  can_update boolean NULL,
  can_delete boolean NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_id)
);

COMMENT ON TABLE public.user_module_permissions IS
  'Per-user capability overrides. NULL inherits role baseline; FALSE explicitly denies; TRUE grants capability only after all other authorization checks.';

-- No client roles can directly read or mutate permission definitions, role
-- assignments, ministry ownership, or approval/audit state in this foundation.
-- Later, narrowly scoped policies/RPCs and grants must be added only after
-- owner approval of the permission matrix and special capabilities.
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_bootstrap_audit ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke app-facing table access on authorization-sensitive data.
-- This is a fail-closed foundation, not a finished app access policy.
REVOKE ALL PRIVILEGES ON TABLE
  public.ministries,
  public.modules,
  public.permissions,
  public.profiles,
  public.role_permissions,
  public.roles,
  public.user_roles,
  public.role_module_permissions,
  public.user_module_permissions,
  public.security_bootstrap_audit
FROM PUBLIC, anon, authenticated, service_role;

-- Permit authenticated users to read only their own profile and update only
-- full_name. Approval fields, IDs, and timestamps are not client-writable.
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name) ON TABLE public.profiles TO authenticated;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own_name
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND id = (SELECT auth.uid()));

-- Guard approval metadata even if future grants/policies are accidentally
-- broadened. Trusted database-owned workflows may update these fields.
CREATE FUNCTION public.guard_profile_approval_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $guard_profile$
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role')
     AND (
       NEW.is_approved IS DISTINCT FROM OLD.is_approved
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     ) THEN
    RAISE EXCEPTION 'Profile approval fields can only be changed by a trusted administrative workflow.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$guard_profile$;

REVOKE ALL PRIVILEGES ON FUNCTION public.guard_profile_approval_fields()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER guard_profile_approval_fields
BEFORE UPDATE OF is_approved, approved_at, approved_by
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_approval_fields();

-- Prevent direct API-role mutation of role assignments. A later reviewed
-- security-definer operation may perform authorized role changes as its owner.
CREATE FUNCTION public.guard_user_role_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $guard_roles$
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Role assignments require a trusted administrative workflow.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$guard_roles$;

REVOKE ALL PRIVILEGES ON FUNCTION public.guard_user_role_mutations()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER guard_user_role_mutations
BEFORE INSERT OR UPDATE OR DELETE
ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.guard_user_role_mutations();

COMMIT;

-- Postconditions to inspect manually after staging-only review/application.
SELECT c.relname AS tablename, c.relrowsecurity AS rowsecurity,
       c.relforcerowsecurity AS forcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN (
    'ministries', 'modules', 'permissions', 'profiles', 'role_permissions',
    'roles', 'user_roles', 'role_module_permissions',
    'user_module_permissions', 'security_bootstrap_audit'
  )
ORDER BY c.relname;

SELECT policyname, tablename, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT
  has_table_privilege('anon', 'public.profiles', 'SELECT') AS anon_can_read_profiles,
  has_table_privilege('authenticated', 'public.profiles', 'SELECT') AS authenticated_can_read_profiles,
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') AS authenticated_can_update_own_name_column,
  has_column_privilege('authenticated', 'public.profiles', 'is_approved', 'UPDATE') AS authenticated_can_update_approval_column,
  has_table_privilege('authenticated', 'public.user_roles', 'INSERT') AS authenticated_can_insert_user_roles,
  has_table_privilege('service_role', 'public.user_roles', 'INSERT') AS service_role_can_insert_user_roles;
