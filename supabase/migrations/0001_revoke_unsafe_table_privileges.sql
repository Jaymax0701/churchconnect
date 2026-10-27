-- ChurchConnect staging privilege hardening (Phase 0)
-- REVIEW ONLY: do not apply to production.
-- Removes non-CRUD table privileges from client-facing and service roles.
-- Deliberately does not grant CRUD; table access must be granted per policy design.
-- Run only after reviewing the current grants and confirming the target is STAGING.
--
-- IMPORTANT: this handles direct grants on the seven existing tables only.
-- The audit also reported broad default privileges associated with supabase_admin.
-- Those defaults must be reviewed and corrected separately in a role context
-- authorized to ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin. Do not assume
-- the current database session can modify another role's defaults.
-- Do not run this draft until the default-privilege finding and intended service_role
-- access have been reviewed. Never apply this file to production without explicit approval.

BEGIN;

DO $$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname IN (
        'ministries', 'modules', 'permissions', 'profiles',
        'role_permissions', 'roles', 'user_roles'
      )
  LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
      EXECUTE format(
        'REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.%I FROM %I',
        t.relname, r
      );
    END LOOP;
  END LOOP;
END
$$;

COMMIT;

-- Postcondition check: should return no rows for these roles/privileges.
SELECT c.relname AS table_name,
       r.rolname AS role_name,
       p.privilege,
       has_table_privilege(r.rolname, c.oid, p.privilege) AS still_granted
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_roles r
CROSS JOIN (
  VALUES ('MAINTAIN'), ('REFERENCES'), ('TRIGGER'), ('TRUNCATE')
) AS p(privilege)
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN (
    'ministries', 'modules', 'permissions', 'profiles',
    'role_permissions', 'roles', 'user_roles'
  )
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
  AND has_table_privilege(r.rolname, c.oid, p.privilege)
ORDER BY c.relname, r.rolname, p.privilege;
