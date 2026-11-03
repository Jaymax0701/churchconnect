# ChurchConnect Authorization Schema Reconciliation

Status: Updated from the owner-supplied staging diagnostics on 2026-11-03. Read-only audit only; no schema or privilege changes were made in this update.

## Verified staging environment

Project: `churchconnect-staging`
Supabase ref: `aibstkdijaruvtvqaxke`
Evidence: owner supplied all eight result sets from `supabase/diagnostics/0002_schema_details.sql` and the complete role/module catalogues on 2026-11-03.

## Current public schema

Seven application tables were inventoried:

- `ministries`: UUID primary key; `name`, unique `slug`, optional `description`, `is_active` default true, `created_at`. No `leader_id`.
- `modules`: text primary key; `name`, optional `description`, `is_active` default true.
- `permissions`: UUID primary key; `module_id` text FK to `modules`; `action` constrained to view/create/update/delete/manage/approve/assign; `scope` constrained to global/assigned_ministry/self; unique (module_id, action, scope).
- `profiles`: UUID primary key/FK to `auth.users(id)`; `full_name`; timestamps; `is_approved boolean NOT NULL DEFAULT false`; `approved_at`; `approved_by` FK to `auth.users(id)`.
- `role_permissions`: composite primary key (role_id, permission_id); text role FK and UUID permission FK. Legacy table retained.
- `roles`: text primary key; `name`, optional `description`, `is_system boolean NOT NULL DEFAULT true`. No `hierarchy_level`.
- `user_roles`: UUID primary key; user and role FKs; scope type global/ministry; optional ministry FK; optional assigning user FK; timestamp. Check constraint enforces global => ministry_id NULL and ministry => ministry_id NOT NULL.

All listed foreign keys and constraints were validated. Unique indexes include ministry slug, module/action/scope permission tuple, role-permission pair, and a user-role unique assignment index using a zero UUID sentinel for global scope.

## Canonical catalogues

Six system roles, all with `is_system = true`:

- `superadmin` — Superadmin
- `church_admin` — Church Admin
- `church_council` — Church Council
- `ministry_leader` — Ministry Leader
- `ministry_volunteer` — Ministry Volunteer
- `member` — Church Member

Twelve active modules:

- `cell_groups`
- `children`
- `cms`
- `congregation`
- `evangelism`
- `member_portal`
- `men`
- `praise_worship`
- `public_site`
- `sunday_service`
- `women`
- `youth`

Use these exact case-sensitive IDs. Older documents and UI examples containing `SUPERADMIN`, `ADMIN`, `portal`, `ministry`, `events`, or `registration` are historical examples or aliases, not verified canonical IDs.

## Current row counts (2026-11-03)

| Table | Rows |
|---|---:|
| ministries | 0 |
| modules | 12 |
| permissions | 0 |
| profiles | 1 |
| role_permissions | 0 |
| roles | 6 |
| user_roles | 1 |

The profile approval columns are present in the current staging schema. Earlier statements in older audit documents that profiles had zero rows or lacked approval fields are superseded by this dated inventory.

## RLS, policies, triggers and grants

- RLS is enabled on all seven tables; `force_rls` is false on each.
- The policy inventory returned no policies.
- The trigger inventory returned no rows for these seven tables.
- The table privilege result showed only `postgres` in the direct ACL output for these seven tables. The separate effective-privilege inventory supplied on 2026-11-03 showed no effective CRUD privileges for `anon`, `authenticated`, or `service_role` on these seven tables.
- This seven-table result is not a full inventory of every public table or external workflow. Preserve the separately audited `ensure_rls` event trigger; it enables RLS on newly created public tables but does not create policies.
- Do not add broad grants. SQL table privileges and RLS policies must be designed together.

## Authorization readiness and blockers

1. `permissions` and `role_permissions` are empty; there are no live role-permission mappings.
2. The 72 role/module CRUD combinations remain PENDING in `ROLE_MODULE_PERMISSION_MATRIX.md`. PENDING means deny.
3. The approved Superadmin rule is a precedence exception only: an authenticated, approved user with a valid `superadmin` assignment bypasses ordinary per-user overrides. It does not automatically grant all modules/actions or bypass approval, scope, integrity, audit, or other safeguards.
4. `manage`, `approve`, and `assign` need explicit capability and scope decisions.
5. `ministries.leader_id` is not present. The proposed one-primary-leader-plus-additional-leaders model in `MINISTRY_SCOPE_DESIGN.md` remains a design proposal, not deployed schema.
6. Role hierarchy is deferred; `roles.hierarchy_level` does not exist. Do not enable delegation based on role names.
7. The repository inspection does not establish whether external services, Edge Functions, jobs, or service-role consumers exist. Owner verification remains required.
8. Live Supabase Auth sign-in/session handling is not yet implemented in the inspected frontend; current login is a demonstration flow.

## Next stage

Proceed with documentation and application authorization reconciliation, not permission seeding:

1. Keep this staging evidence as the current schema baseline.
2. Complete the trusted administrative workflow inventory with owner-confirmed Present/Absent/Unknown status.
3. Review the permission matrix and special capabilities; no grants are inferred.
4. Reconcile the proposed authorization foundation draft against the verified schema and privilege evidence.
5. Only after design decisions and trusted-workflow review, prepare a staging-only migration review. No production action is implied.

No database writes, permission grants, RLS policies, or production changes were performed for this reconciliation.
