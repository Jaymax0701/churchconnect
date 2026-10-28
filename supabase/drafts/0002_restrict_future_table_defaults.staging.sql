-- SAFETY: staging-only review artifact; intentionally outside supabase/migrations.
-- Do not run via automated migration deployment or apply to production.

-- ChurchConnect: restrict default privileges for future public tables.
-- REVIEW ONLY: staging draft; NOT EXECUTED.
--
-- Audit findings:
-- * postgres-owned public-table defaults grant MAINTAIN, REFERENCES, TRIGGER,
--   and TRUNCATE to anon, authenticated, and service_role.
-- * supabase_admin-owned public-table defaults grant CRUD plus those extra
--   privileges to the same roles.
-- * The current SQL session is postgres and is not a member of supabase_admin.
--
-- This file ONLY changes postgres-owned defaults, which the audited session
-- can manage. It deliberately does not attempt to change supabase_admin-owned
-- defaults. Resolve those separately through an authorized Supabase/platform
-- administrative path; do not change privileged role memberships to bypass
-- the access boundary.
--
-- Future migrations must explicitly grant only required table privileges,
-- together with reviewed RLS policies. Review service_role access requirements
-- before applying.

BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role;

COMMIT;

-- Postcondition: should return no postgres-owned public table default ACL
-- privileges for these three API roles. supabase_admin rows may remain and
-- are intentionally outside this migration's authority.
SELECT n.nspname AS schema_name,
       owner.rolname AS default_privilege_owner,
       grantee.rolname AS grantee,
       d.defaclobjtype AS object_type,
       x.privilege_type,
       x.is_grantable
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid = d.defaclnamespace
JOIN pg_roles owner ON owner.oid = d.defaclrole
CROSS JOIN LATERAL aclexplode(d.defaclacl) x
JOIN pg_roles grantee ON grantee.oid = x.grantee
WHERE n.nspname = 'public'
  AND d.defaclobjtype = 'r'
  AND owner.rolname IN ('postgres', 'supabase_admin')
  AND grantee.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY owner.rolname, grantee.rolname, x.privilege_type;
