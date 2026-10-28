-- ChurchConnect privilege-source audit
-- READ-ONLY. Run against STAGING. No schema or data changes.
-- Identifies direct ACL entries, PUBLIC ACL entries, role memberships,
-- and default privileges that may explain effective privileges.

-- 1) Direct relation ACL entries and grantors on the seven application tables.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC'
            ELSE pg_get_userbyid(a.grantee) END AS grantee,
       pg_get_userbyid(a.grantor) AS grantor,
       a.privilege_type,
       a.is_grantable
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(
  COALESCE(c.relacl, acldefault('r', c.relowner))
) AS a
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
  AND c.relname IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles'
  )
  AND a.privilege_type IN (
    'SELECT','INSERT','UPDATE','DELETE','TRUNCATE',
    'REFERENCES','TRIGGER','MAINTAIN'
  )
ORDER BY c.relname, grantee, a.privilege_type;

-- 2) Memberships of application roles in other database roles.
-- A role may inherit privileges through memberships.
SELECT member.rolname AS member_role,
       parent.rolname AS granted_role,
       m.admin_option,
       m.inherit_option,
       m.set_option
FROM pg_auth_members m
JOIN pg_roles member ON member.oid = m.member
JOIN pg_roles parent ON parent.oid = m.roleid
WHERE member.rolname IN ('anon','authenticated','service_role')
   OR parent.rolname IN ('anon','authenticated','service_role')
ORDER BY member_role, granted_role;

-- 3) Default table privileges configured for schemas/roles.
SELECT COALESCE(n.nspname, '<all schemas>') AS schema_name,
       pg_get_userbyid(d.defaclrole) AS grantor_role,
       CASE WHEN x.grantee = 0 THEN 'PUBLIC'
            ELSE pg_get_userbyid(x.grantee) END AS grantee,
       x.privilege_type,
       x.is_grantable,
       d.defaclobjtype AS object_type
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) x
WHERE d.defaclobjtype = 'r'
  AND (n.nspname = 'public' OR d.defaclnamespace = 0)
ORDER BY schema_name, grantor_role, grantee, x.privilege_type;

-- 4) Re-check effective unsafe privileges for all seven tables.
SELECT c.relname AS table_name,
       r.rolname AS role_name,
       p.privilege,
       has_table_privilege(r.rolname, c.oid, p.privilege) AS effective
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_roles r
CROSS JOIN (
  VALUES ('REFERENCES'), ('TRIGGER'), ('TRUNCATE')
) AS p(privilege)
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
  AND c.relname IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles'
  )
  AND r.rolname IN ('anon','authenticated','service_role')
  AND has_table_privilege(r.rolname, c.oid, p.privilege)
ORDER BY c.relname, r.rolname, p.privilege;
