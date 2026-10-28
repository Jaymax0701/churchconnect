-- ChurchConnect complete privilege preflight
-- READ-ONLY. Run against STAGING first. No schema or data changes.
-- Shows explicit ACL entries (including PUBLIC) and effective table privileges
-- for the standard Supabase roles on all public tables.

-- 1) Explicit relation ACL entries. PUBLIC is represented as grantee_name = 'PUBLIC'.
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
            ELSE pg_get_userbyid(acl.grantee) END AS grantee_name,
       acl.privilege_type AS privilege,
       acl.is_grantable
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p','v','m','f')
ORDER BY c.relname, grantee_name, privilege;

-- 2) Effective table privileges, including inherited and PUBLIC grants.
WITH target_roles(role_name) AS (
  VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')
),
public_objects AS (
  SELECT c.oid, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r','p','v','m','f')
)
SELECT o.relname AS object_name,
       r.role_name,
       p.privilege,
       has_table_privilege(r.role_name, o.oid, p.privilege) AS effective_privilege
FROM public_objects o
CROSS JOIN target_roles r
CROSS JOIN (VALUES
  ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
  ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
) p(privilege)
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.role_name)
ORDER BY o.relname, r.role_name, p.privilege;

-- 3) Public schema privileges for the standard Supabase roles.
WITH target_roles(role_name) AS (
  VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')
)
SELECT r.role_name,
       has_schema_privilege(r.role_name, 'public', 'USAGE') AS can_use_schema,
       has_schema_privilege(r.role_name, 'public', 'CREATE') AS can_create_in_schema
FROM target_roles r
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.role_name)
ORDER BY r.role_name;
