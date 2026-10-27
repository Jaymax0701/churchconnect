-- ChurchConnect full schema detail inventory
-- READ-ONLY: run against STAGING only.
-- This script does not create, alter, or delete objects or data.
-- It deliberately does not output profile names, emails, or row contents.

-- 1. Exact columns, types, nullability, defaults, identity/generated metadata
SELECT c.table_name, c.ordinal_position, c.column_name, c.data_type,
       c.udt_schema, c.udt_name, c.is_nullable, c.column_default,
       c.is_identity, c.identity_generation, c.is_generated, c.generation_expression
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 2. Full constraints (including exact CHECK expressions and FK actions)
SELECT conrelid::regclass::text AS table_name,
       conname AS constraint_name,
       CASE contype
         WHEN 'p' THEN 'PRIMARY KEY'
         WHEN 'f' THEN 'FOREIGN KEY'
         WHEN 'u' THEN 'UNIQUE'
         WHEN 'c' THEN 'CHECK'
         WHEN 'x' THEN 'EXCLUSION'
         ELSE contype::text
       END AS constraint_type,
       pg_get_constraintdef(oid, true) AS definition,
       convalidated AS is_validated,
       condeferrable AS is_deferrable,
       condeferred AS initially_deferred
FROM pg_catalog.pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conrelid::regclass::text IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles'
  )
ORDER BY table_name, constraint_type, constraint_name;

-- 3. Index definitions
SELECT schemaname, tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles'
  )
ORDER BY tablename, indexname;

-- 4. RLS state and grants (including table-level privileges)
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       g.grantee, g.privilege_type, g.is_grantable
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN information_schema.role_table_grants AS g
  ON g.table_schema = n.nspname AND g.table_name = c.relname
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
  AND c.relname IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles'
  )
ORDER BY c.relname, g.grantee, g.privilege_type;

-- 5. Existing policies
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles'
  )
ORDER BY tablename, policyname;

-- 6. Trigger definitions on the seven public tables
SELECT c.relname AS table_name, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid, true) AS definition,
       t.tgenabled AS enabled_state,
       p.proname AS handler_function,
       pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings
FROM pg_catalog.pg_trigger AS t
JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_proc AS p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND c.relname IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles'
  )
ORDER BY c.relname, t.tgname;

-- 7. Non-sensitive aggregate counts only
SELECT 'ministries' AS table_name, count(*) AS row_count FROM public.ministries
UNION ALL SELECT 'modules', count(*) FROM public.modules
UNION ALL SELECT 'permissions', count(*) FROM public.permissions
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'role_permissions', count(*) FROM public.role_permissions
UNION ALL SELECT 'roles', count(*) FROM public.roles
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
ORDER BY table_name;

-- 8. Canonical role/module identifiers and active/system flags
SELECT id, name, is_system FROM public.roles ORDER BY id;
SELECT id, name, is_active FROM public.modules ORDER BY id;
