-- ChurchConnect staging diagnostic 0005
-- READ ONLY. Run in the staging SQL Editor before considering migration 0002.
-- This checks the current SQL session identity, relevant role attributes,
-- role membership, and default ACLs. It does not alter privileges.

-- Result set 1: current SQL session and authority-relevant role attributes.
SELECT current_user AS current_user_name,
       session_user AS session_user_name,
       r.rolname,
       r.rolsuper,
       r.rolcreaterole,
       r.rolcanlogin
FROM pg_roles r
WHERE r.rolname IN (
  current_user,
  session_user,
  'postgres',
  'supabase_admin',
  'anon',
  'authenticated',
  'service_role'
)
ORDER BY r.rolname;

-- Result set 2: membership/effective membership checks for default-ACL owners.
SELECT current_user AS current_user_name,
       target.rolname AS target_role,
       pg_has_role(current_user, target.oid, 'MEMBER') AS is_member,
       pg_has_role(current_user, target.oid, 'USAGE') AS privileges_inherited
FROM pg_roles target
WHERE target.rolname IN ('postgres', 'supabase_admin')
ORDER BY target.rolname;

-- Result set 3: current default table ACL entries in public for API roles.
SELECT n.nspname AS schema_name,
       owner.rolname AS default_privilege_owner,
       grantee.rolname AS grantee,
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
