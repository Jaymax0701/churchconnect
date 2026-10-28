-- ChurchConnect: restrict default privileges for future public tables.
-- REVIEW ONLY: draft for STAGING; NOT EXECUTED.
-- The staging diagnostic reported broad default table privileges for anon,
-- authenticated, and service_role under both postgres and supabase_admin.
--
-- This removes all default table privileges for those API roles from tables
-- created by either owner in public. Future migrations must explicitly grant
-- only the CRUD privileges needed, paired with reviewed RLS policies.
--
-- Prerequisites:
-- 1. Confirm this is the staging project, never production.
-- 2. Confirm the current session is authorized to alter default privileges
--    for BOTH postgres and supabase_admin. If either statement is denied,
--    stop and resolve role ownership/authority; do not work around it by
--    changing platform-owned roles or memberships.
-- 3. Review service_role usage before execution.
--
-- This migration intentionally fails atomically if the session cannot change
-- one of the owners' default privileges.

BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role;

COMMIT;

-- Postcondition: inspect pg_default_acl for public table defaults.
-- The query reports remaining default ACL entries for these API roles.
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
