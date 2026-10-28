# ChurchConnect Authorization Migration Design (Staging First)

Status: DESIGN PROPOSAL — not executable SQL. Do not apply to production.

Branch: security/milestone-2-migration-plan

## 1. Verified staging baseline

Existing public tables:
- ministries(id uuid, name, slug, description, is_active, created_at)
- modules(id text, name, description, is_active)
- permissions(id uuid, module_id text, action text, scope text)
- profiles(id uuid references auth.users(id) on delete cascade, full_name, created_at, updated_at)
- role_permissions(role_id text, permission_id uuid)
- roles(id text, name, description, is_system)
- user_roles(id uuid, user_id uuid references auth.users(id) on delete cascade, role_id text, scope_type, ministry_id uuid, assigned_by uuid, created_at)

Staging data verified:
- Roles: superadmin, church_council, church_admin, ministry_leader, ministry_volunteer, member
- Modules: cell_groups, children, cms, congregation, evangelism, member_portal, men, praise_worship, public_site, sunday_service, women, youth
- role_permissions, permissions, and user_roles returned no rows.
- profiles returned zero rows.
- RLS enabled on all seven tables; no policies returned for these tables.
- No triggers on roles, user_roles, profiles.
- Event trigger ensure_rls is enabled and should be preserved.
- Current profile table has no approval field; roles has no hierarchy field.

## 2. Proposed authorization data model

Keep legacy tables `permissions` and `role_permissions` for compatibility/audit, but do not use them in live permission evaluation.

Add:
1. `role_module_permissions`: one row per role and module, with explicit boolean capabilities (view/create/update/delete; optionally manage/approve/assign only if the product requires them). Unique(role_id, module_id); foreign keys to roles/modules.
2. `user_module_permissions`: one row per user and module with nullable boolean capability overrides; NULL means no override, FALSE explicitly denies, TRUE explicitly grants. Unique(user_id, module_id); foreign key to auth.users and modules.
3. `profiles.is_approved boolean NOT NULL DEFAULT false`: new accounts default to unapproved; approval changes must be protected server-side. Existing profile records, if any in another environment, must not be silently approved.
4. `roles.hierarchy_level integer NOT NULL`: numeric assignment hierarchy. Exact levels are a product/security decision and must be confirmed before executable migration; do not infer that church_council and church_admin have a particular relative ordering without approval.

Do not add speculative modules called `portal`, `ministry`, `events`, or `registration`. Map `portal` to the existing `member_portal` only if approved. Events, ministry management, and registration workflows should use existing modules or receive new module rows only after confirming actual application domains.

## 3. Permission resolution

- Unauthenticated callers receive only explicitly public-site read access through narrowly scoped policies.
- Authenticated users must be approved for internal features; unapproved users may access only their own minimal profile as defined by policy.
- **Owner-approved precedence (2026-10-28):** after authentication and account-approval/integrity gates pass, a caller with a valid `superadmin` assignment bypasses ordinary per-user overrides in `user_module_permissions`, including explicit FALSE/DENY and TRUE/ALLOW values. Evaluate this superadmin path before checking per-user overrides.
- For non-superadmins, an explicit user FALSE => deny; explicit user TRUE => continue to applicable scope gates; otherwise union applicable role grants; otherwise deny.
- Approval, active module/ministry, record-scope and ownership checks, database constraints, and agreed audit/safeguard requirements remain separate gates; a permission grant or superadmin status must not bypass them.
- Superadmin status must be determined from the canonical role ID `superadmin` and trusted `auth.uid()`, not by caller-supplied user IDs. This decision does not approve any role/module/action matrix entries or permission seeds.
- Record-level policies must be designed per real table. Do not invent policies for events/rosters until those tables exist.

## 4. Role and assignment safeguards

- A caller cannot assign a role to themselves, approve themselves, or edit protected privilege fields.
- Role assignment is permitted only to an authorized administrator whose hierarchy level exceeds the target role's level, subject to a specifically defined exception for superadmin.
- System role definitions are immutable to ordinary administrators.
- Keep at least one approved superadmin. A concurrency-safe trigger must serialize all role/profile/auth-user paths that can remove, deactivate, or demote a superadmin. The trigger must handle INSERT, UPDATE, DELETE correctly and use the actual lowercase role ID.
- Do not rely on the current ON DELETE CASCADE from roles to user_roles as the only safeguard. Add a role-deletion guard or alter delete semantics in the reviewed migration so a protected role cannot disappear through a cascade.
- Every SECURITY DEFINER function must have a restricted search_path, schema-qualified object references, revoked PUBLIC execute by default, narrow grants, and identity checks grounded in auth.uid().

## 5. Grants and RLS

RLS and SQL privileges must be reviewed together. Policies cannot grant privileges that table grants withhold, and broad grants are not a substitute for RLS. For each table:
- Grant only required operations to anon/authenticated.
- Revoke unnecessary TRUNCATE, REFERENCES, and TRIGGER privileges from client roles.
- Preserve service_role/server administration requirements intentionally.
- Keep ensure_rls event trigger enabled; it enables RLS but does not create policies.

## 6. Required staging validation before production consideration

1. Apply only to staging and verify migration is transactional/idempotent as appropriate.
2. Test anonymous public-site read and denial of private tables.
3. Test unapproved user's self-profile-only access and denial to internal data.
4. Test approved member access and cross-user profile denial.
5. Test each role/module grant, explicit user TRUE, explicit user FALSE, and default deny.
6. Test ministry-scope isolation across multiple assignments.
7. Test self-role-assignment, self-approval, protected-role edits, and hierarchy violations.
8. In two concurrent sessions, verify last-superadmin protection against simultaneous demotions/deletions/deactivation and auth.users deletion.
9. Verify inactive modules/ministries deny non-superadmin access.
10. Run application build/lint and test actual route/data access; frontend guards alone are insufficient.

## 7. Open decisions before executable migration

- Confirm role hierarchy ordering, especially church_council versus church_admin.
- Confirm whether member approval is a boolean only or needs approved_by/approved_at audit fields.
- Confirm whether permissions need manage/approve/assign capabilities or only view/create/update/delete.
- Confirm whether module names should remain the 12 existing IDs or whether new modules are needed for workflows not represented in current schema.
- Inventory real application tables and data access paths before authoring table-specific RLS policies.

No SQL in this document should be executed. This is a design checkpoint for review. Staging-only SQL drafts are intentionally stored under `supabase/drafts/`, not `supabase/migrations/`, until reviewed and approved for a controlled deployment.
