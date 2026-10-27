-- ChurchConnect authorization preflight inventory
-- READ-ONLY: run against the STAGING database first.
-- This script does not create, alter, or delete any objects or data.

-- 1) Columns, types, defaults, nullability
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles',
    'role_module_permissions','user_module_permissions'
  )
ORDER BY table_name, ordinal_position;

-- 2) Constraints and referenced columns
SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name AS referenced_table,
       ccu.column_name AS referenced_column, cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
 AND kcu.table_name = tc.table_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.check_constraints cc
  ON cc.constraint_schema = tc.constraint_schema
 AND cc.constraint_name = tc.constraint_name
WHERE tc.constraint_schema = 'public'
  AND tc.table_name IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles',
    'role_module_permissions','user_module_permissions'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 3) RLS state and table grants
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       grantee, privilege_type, is_grantable
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN information_schema.role_table_grants g
  ON g.table_schema = n.nspname AND g.table_name = c.relname
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
  AND c.relname IN (
    'ministries','modules','permissions','profiles',
    'role_permissions','roles','user_roles',
    'role_module_permissions','user_module_permissions'
  )
ORDER BY c.relname, grantee, privilege_type;

-- 4) Existing policies
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5) Canonical roles and modules (IDs must not be guessed)
SELECT to_jsonb(r) AS role_row FROM public.roles r ORDER BY to_jsonb(r)::text;
SELECT to_jsonb(m) AS module_row FROM public.modules m ORDER BY to_jsonb(m)::text;

-- 6) Existing assignment and legacy permission rows, if present
SELECT 'user_roles' AS source, to_jsonb(x) AS row_data
FROM public.user_roles x
UNION ALL
SELECT 'role_permissions', to_jsonb(x)
FROM public.role_permissions x
UNION ALL
SELECT 'permissions', to_jsonb(x)
FROM public.permissions
ORDER BY source, row_data::text;

-- 7) Profiles: inspect only column shape and aggregate approval states;
-- do not output names, email addresses, or other personal data.
SELECT count(*) AS profile_count
FROM public.profiles;

-- 8) Security-definer functions and event triggers relevant to authorization
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS settings,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%permission%'
       OR p.proname ILIKE '%superadmin%'
       OR p.proname ILIKE '%approved%'
       OR p.proname ILIKE '%rls%'
       OR p.proname ILIKE '%admin%')
ORDER BY p.proname;

SELECT evtname, evtevent, evtenabled, evttags,
       p.proname AS handler_function
FROM pg_event_trigger e
JOIN pg_proc p ON p.oid = e.evtfoid
ORDER BY evtname;

-- 9) Row counts for relevant tables
SELECT 'ministries' AS table_name, count(*) AS row_count FROM public.ministries
UNION ALL SELECT 'modules', count(*) FROM public.modules
UNION ALL SELECT 'permissions', count(*) FROM public.permissions
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'role_permissions', count(*) FROM public.role_permissions
UNION ALL SELECT 'roles', count(*) FROM public.roles
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
ORDER BY table_name;
