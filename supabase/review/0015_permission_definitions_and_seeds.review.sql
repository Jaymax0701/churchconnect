-- ============================================================
-- ChurchConnect
-- Review script: 0015_permission_definitions_and_seeds.review.sql
-- Purpose: Canonical permission definitions and approved
--          role-to-permission grants.
-- Status: MANUAL REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL
--
-- Uses the existing public.permissions and
-- public.role_permissions tables. Does not introduce a second
-- permission engine and does not delete existing mappings.
--
-- Permission definitions:
--   12 modules x 7 actions x 3 scopes = 252 definitions.
--
-- Only approved ALLOW grants are inserted into role_permissions.
-- Missing mappings represent DENY. PENDING capabilities are
-- intentionally not granted.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Seed all canonical permission definitions.
-- ON CONFLICT DO NOTHING preserves existing definitions.
-- ------------------------------------------------------------

INSERT INTO public.permissions (module_id, action, scope)
SELECT
    m.id,
    a.action,
    s.scope
FROM public.modules AS m
CROSS JOIN (
    VALUES
        ('view'::text),
        ('create'::text),
        ('update'::text),
        ('delete'::text),
        ('manage'::text),
        ('approve'::text),
        ('assign'::text)
) AS a(action)
CROSS JOIN (
    VALUES
        ('global'::text),
        ('assigned_ministry'::text),
        ('self'::text)
) AS s(scope)
WHERE m.id IN (
    'public_site',
    'member_portal',
    'congregation',
    'cell_groups',
    'youth',
    'children',
    'women',
    'men',
    'evangelism',
    'praise_worship',
    'sunday_service',
    'cms'
)
ON CONFLICT (module_id, action, scope) DO NOTHING;


-- ------------------------------------------------------------
-- 2. Define the approved role/module capability profiles.
--
-- F = Full administration:
--     view, create, update, delete, manage
--
-- M = Ministry management:
--     view, create, update, manage
--
-- O = Operational:
--     view, create, update
--
-- V = Read-only:
--     view
--
-- S = Self-service:
--     view, update (own records only)
--
-- No row means no access.
--
-- Scope:
--   global           = global role capability
--   assigned_ministry = only the assigned ministry, and only
--                       when the ministry and module mapping
--                       are active
--   self             = own-record capability only
--
-- Resource-level RLS must still restrict which rows can be
-- viewed or modified. A global 'view' grant does not expose
-- private records.
-- ------------------------------------------------------------

WITH role_module_profiles (
    role_id,
    module_id,
    profile,
    permission_scope
) AS (
    VALUES
        -- SUPERADMIN: full baseline across all modules.
        ('superadmin', 'public_site',       'F', 'global'),
        ('superadmin', 'member_portal',     'F', 'global'),
        ('superadmin', 'congregation',      'F', 'global'),
        ('superadmin', 'cell_groups',       'F', 'global'),
        ('superadmin', 'youth',             'F', 'global'),
        ('superadmin', 'children',          'F', 'global'),
        ('superadmin', 'women',             'F', 'global'),
        ('superadmin', 'men',               'F', 'global'),
        ('superadmin', 'evangelism',        'F', 'global'),
        ('superadmin', 'praise_worship',    'F', 'global'),
        ('superadmin', 'sunday_service',    'F', 'global'),
        ('superadmin', 'cms',               'F', 'global'),

        -- CHURCH ADMIN: full baseline across all modules.
        ('church_admin', 'public_site',       'F', 'global'),
        ('church_admin', 'member_portal',     'F', 'global'),
        ('church_admin', 'congregation',      'F', 'global'),
        ('church_admin', 'cell_groups',       'F', 'global'),
        ('church_admin', 'youth',             'F', 'global'),
        ('church_admin', 'children',          'F', 'global'),
        ('church_admin', 'women',             'F', 'global'),
        ('church_admin', 'men',               'F', 'global'),
        ('church_admin', 'evangelism',        'F', 'global'),
        ('church_admin', 'praise_worship',    'F', 'global'),
        ('church_admin', 'sunday_service',    'F', 'global'),
        ('church_admin', 'cms',               'F', 'global'),

        -- CHURCH COUNCIL: read-only across all modules.
        ('church_council', 'public_site',       'V', 'global'),
        ('church_council', 'member_portal',     'V', 'global'),
        ('church_council', 'congregation',      'V', 'global'),
        ('church_council', 'cell_groups',       'V', 'global'),
        ('church_council', 'youth',             'V', 'global'),
        ('church_council', 'children',          'V', 'global'),
        ('church_council', 'women',             'V', 'global'),
        ('church_council', 'men',               'V', 'global'),
        ('church_council', 'evangelism',        'V', 'global'),
        ('church_council', 'praise_worship',    'V', 'global'),
        ('church_council', 'sunday_service',    'V', 'global'),
        ('church_council', 'cms',               'V', 'global'),

        -- MINISTRY LEADER:
        -- Congregation visibility is limited to assigned ministry.
        ('ministry_leader', 'congregation',      'V', 'assigned_ministry'),
        ('ministry_leader', 'cell_groups',       'M', 'assigned_ministry'),
        ('ministry_leader', 'youth',             'M', 'assigned_ministry'),
        ('ministry_leader', 'children',          'M', 'assigned_ministry'),
        ('ministry_leader', 'women',             'M', 'assigned_ministry'),
        ('ministry_leader', 'men',               'M', 'assigned_ministry'),
        ('ministry_leader', 'evangelism',        'M', 'assigned_ministry'),
        ('ministry_leader', 'praise_worship',    'M', 'assigned_ministry'),
        ('ministry_leader', 'sunday_service',    'M', 'assigned_ministry'),
        ('ministry_leader', 'cms',               'M', 'assigned_ministry'),

        -- MINISTRY VOLUNTEER:
        -- Operational permissions only within assigned ministry.
        ('ministry_volunteer', 'congregation',      'V', 'assigned_ministry'),
        ('ministry_volunteer', 'cell_groups',       'O', 'assigned_ministry'),
        ('ministry_volunteer', 'youth',             'O', 'assigned_ministry'),
        ('ministry_volunteer', 'children',          'O', 'assigned_ministry'),
        ('ministry_volunteer', 'women',             'O', 'assigned_ministry'),
        ('ministry_volunteer', 'men',               'O', 'assigned_ministry'),
        ('ministry_volunteer', 'evangelism',        'O', 'assigned_ministry'),
        ('ministry_volunteer', 'praise_worship',    'O', 'assigned_ministry'),
        ('ministry_volunteer', 'sunday_service',    'O', 'assigned_ministry'),

        -- MEMBER:
        -- Published/member-visible content is filtered by resource
        -- RLS. Self-service remains restricted to the user's own
        -- member portal and congregation records.
        ('member', 'public_site',       'V', 'global'),
        ('member', 'member_portal',     'S', 'self'),
        ('member', 'congregation',      'S', 'self'),
        ('member', 'cell_groups',       'V', 'global'),
        ('member', 'youth',             'V', 'global'),
        ('member', 'children',          'V', 'global'),
        ('member', 'women',             'V', 'global'),
        ('member', 'men',               'V', 'global'),
        ('member', 'evangelism',        'V', 'global'),
        ('member', 'praise_worship',    'V', 'global'),
        ('member', 'sunday_service',    'V', 'global')
),
profile_actions (profile, action) AS (
    VALUES
        ('F', 'view'),
        ('F', 'create'),
        ('F', 'update'),
        ('F', 'delete'),
        ('F', 'manage'),

        ('M', 'view'),
        ('M', 'create'),
        ('M', 'update'),
        ('M', 'manage'),

        ('O', 'view'),
        ('O', 'create'),
        ('O', 'update'),

        ('V', 'view'),

        ('S', 'view'),
        ('S', 'update')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT
    rmp.role_id,
    p.id
FROM role_module_profiles AS rmp
JOIN profile_actions AS pa
    ON pa.profile = rmp.profile
JOIN public.permissions AS p
    ON p.module_id = rmp.module_id
   AND p.action = pa.action
   AND p.scope = rmp.permission_scope
JOIN public.roles AS r
    ON r.id = rmp.role_id
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ------------------------------------------------------------
-- 3. Read-only seed verification.
-- These queries return counts and the resulting role/module
-- grant matrix. They do not modify data.
-- ------------------------------------------------------------

-- Expected canonical permission definitions: 252.
SELECT
    COUNT(*) AS canonical_permission_definition_count,
    COUNT(DISTINCT module_id) AS module_count,
    COUNT(DISTINCT action) AS action_count,
    COUNT(DISTINCT scope) AS scope_count
FROM public.permissions
WHERE module_id IN (
    'public_site',
    'member_portal',
    'congregation',
    'cell_groups',
    'youth',
    'children',
    'women',
    'men',
    'evangelism',
    'praise_worship',
    'sunday_service',
    'cms'
);

-- Actual number of grants per canonical role.
SELECT
    rp.role_id,
    COUNT(*) AS granted_permission_count
FROM public.role_permissions AS rp
JOIN public.permissions AS p
    ON p.id = rp.permission_id
WHERE p.module_id IN (
    'public_site',
    'member_portal',
    'congregation',
    'cell_groups',
    'youth',
    'children',
    'women',
    'men',
    'evangelism',
    'praise_worship',
    'sunday_service',
    'cms'
)
GROUP BY rp.role_id
ORDER BY rp.role_id;

COMMIT;

-- ============================================================
-- REVIEW GATES
--
-- 1. Confirm all 12 canonical modules exist and are active as
--    expected before approving execution.
-- 2. Confirm the seven action values match the live CHECK
--    constraint.
-- 3. Confirm the three permission scopes match the live CHECK.
-- 4. Confirm role IDs match the canonical six roles.
-- 5. Review resulting grants against the approved 6 x 12 matrix.
-- 6. Confirm resource-level RLS before enabling member-wide
--    published-content reads.
--
-- This script intentionally does not delete or revoke existing
-- role_permissions rows. Any reconciliation/removal must be a
-- separate reviewed migration.
-- ============================================================
