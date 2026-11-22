# ChurchConnect Application Authorization Inventory

Status: Current repository and owner-supplied database review. Inspection only; no application or database changes were made during this review.

Inspection date: 2026-11-22
Repository: `Jaymax0701/churchconnect`
Branch/commit: `main` / `155b94ff22ae52760da09d4f61df1117c2f1aaf2` (PR #50 merge)
Database project reviewed from owner-supplied SQL/catalog output: `iikdiuezfnwgsjhvedzk`
Scope: current route configuration, admin/member/public layouts, authorization references in tracked frontend source, Supabase review-script directory, existing authorization design documents, and owner-supplied live database schema/function/security inventory.

> Evidence distinction: frontend findings below were checked against GitHub at the commit above. Database findings are based on SQL and catalog output supplied by the project owner on 2026-11-22; they were not queried directly by this inventory. Older authorization documents may describe a prior staging snapshot and should not override this dated inventory without fresh verification.

## 1. Current frontend findings

### APP-AUTH-01 — Authentication and approval route gates exist

The current route tree in `src/routes/AppRoutes.tsx` places the member portal and admin console under `RequireApprovedUser`. The admin console is additionally nested under `RequireSuperadmin`.

- `RequireApprovedUser` requires a signed-in user, a loaded profile, and `profile.is_approved === true`; profile-loading errors fail closed.
- `RequireSuperadmin` calls `supabase.rpc("current_user_has_role", { required_role: "superadmin" })`; RPC errors and false results deny admin access.
- This is route-level UX/access gating. PostgreSQL grants, RLS, and trusted database operations remain the security boundary.

This supersedes the 2026-10-28 inventory statement that member/admin routes had no guards and the login flow was only a demonstration.

### APP-AUTH-02 — Admin route coverage is incomplete

The current admin route tree contains:
- `/admin` — `AdminDashboardPage`
- `/admin/users` — `UserAccountsPage`

There are no registered routes for Ministry Management, Events & Services, or Permission Matrix. The corresponding desktop and mobile items in `src/layouts/AdminLayout.tsx` are hash anchors (`#ministries`, `#events`, `#permissions`), not React Router routes. Selecting them changes the URL hash but does not render a corresponding page.

The AdminLayout also renders a hardcoded `SUPERADMIN` badge rather than deriving the displayed role from a general role-resolution result. This should be addressed as part of role-aware UI work, without weakening the existing route/database gate.

### APP-AUTH-03 — Existing admin workflows are database-backed, but ministry/RBAC UI is absent

- `AdminDashboardPage` calls `list_pending_accounts`, `approve_account`, and `review_minor_registration` for account approval and minor-review workflows.
- `UserAccountsPage` calls `list_user_accounts` and invokes the `admin-manage-user` Edge Function for approved account-management actions.
- No ministry CRUD page, role-assignment UI, or permission-matrix page is currently registered in `AppRoutes.tsx`.
- No general-purpose frontend permission helper or usage of `role_permissions`, `permissions`, or ministry-scoped `user_roles` was found in the tracked `src/**/*.ts(x)` search performed for this review. Existing role-aware checks are limited to the global `superadmin` RPC calls in `RequireSuperadmin`, `MemberPortalLayout`, and `PublicLayout`.

The current admin dashboard is not merely the earlier demo-only dashboard described by the 2026-10-28 inventory; it now handles real account approval and minor-review RPC workflows. Keep these account workflows separate from ministry/RBAC work.

### APP-AUTH-04 — Supabase review scripts are manual artifacts, not migrations

The existing `0002_global_role_check.review.sql` is a historical review artifact, not a safe reapplication candidate. Its function body checks only the global role assignment and does not include the current owner-supplied approved-profile condition. Reapplying it would replace the stronger current `current_user_has_role(text)` definition with a weaker version. Preserve the current live definition; do not execute this older script without reconciling and rewriting it first.


The repository contains `supabase/review/` with numbered `.review.sql` files, including `0002_global_role_check.review.sql`. The local project inspected by the owner has `supabase/config.toml`, `supabase/functions/`, `supabase/review/`, and `.temp/`; it has no `supabase/migrations/` directory.

Review scripts are not automatically applied by GitHub or by the Supabase CLI migration mechanism. Do not create a migration directory or move review scripts into it without a deliberate, reviewed migration workflow. Inspect the existing review scripts directly from GitHub before proposing changes.

### APP-AUTH-05 — Canonical role and module identifiers

Six canonical system roles:
- `superadmin`
- `church_council`
- `church_admin`
- `ministry_leader`
- `ministry_volunteer`
- `member`

Twelve canonical modules:
- `public_site`
- `member_portal`
- `congregation`
- `cell_groups`
- `youth`
- `children`
- `women`
- `men`
- `evangelism`
- `praise_worship`
- `sunday_service`
- `cms`

Do not introduce legacy aliases such as `portal`, `ministry`, `events`, or `registration` as canonical module IDs without an approved schema decision.

## 2. Current database findings (owner-supplied evidence, 2026-11-22)

Existing tables:
- `ministries`: `id`, `name`, `slug`, `description`, `is_active`, `created_at`
- `modules`: `id`, `name`, `description`, `is_active`
- `permissions`: `id`, `module_id`, `action`, `scope`
- `role_permissions`: `role_id`, `permission_id`
- `roles`: `id`, `name`, `description`, `is_system`
- `user_roles`: `id`, `user_id`, `role_id`, `scope_type`, `ministry_id`, `assigned_by`, `created_at`

The owner reports:
- `ministries` is empty.
- `roles` contains the six canonical system roles.
- `modules` contains the twelve canonical modules.
- `permissions` and `role_permissions` are empty.
- `user_roles` contains the owner's single global `superadmin` assignment.
- `permissions.action` allows `view`, `create`, `update`, `delete`, `manage`, `approve`, and `assign`.
- `permissions.scope` allows `global`, `assigned_ministry`, and `self`.
- `user_roles.scope_type` allows `global` and `ministry`; a global assignment must have a NULL ministry, and a ministry assignment must have a non-NULL ministry.
- `permissions` has a unique constraint on `(module_id, action, scope)`; `role_permissions` has composite primary key `(role_id, permission_id)`.
- `user_roles` has a primary key on `id`, but no unique constraint currently prevents duplicate user/role/scope assignments. This remains a design/review item.

RLS is enabled on all six tables. The owner reports no RLS policies on these tables at the time of inspection. The owner-supplied grants show `anon` and `authenticated` table privileges on `ministries` and `modules`, while the other four tables have no direct `anon`/`authenticated` grants. With no applicable policies, those grants on ministries/modules do not by themselves allow ordinary API access. Do not add broad grants or policies as a workaround.

### Existing authorization functions and safeguards

The owner supplied current definitions/catalog results for:
- `current_user_has_role(text)`: SECURITY DEFINER, fixed empty search path; checks the authenticated user's global role and approved profile.
- `guard_canonical_superadmin_role()`: prevents deletion or unsafe mutation of the canonical `superadmin` role.
- `guard_last_global_superadmin_role()`: protects removal/demotion of an active approved global Superadmin assignment.
- `assert_another_active_global_superadmin(uuid)`: serializes the invariant using a transaction-level lock on the canonical role row and requires another active, approved, non-deleted, non-banned global Superadmin.
- Triggers exist on `roles` before UPDATE/DELETE and on `user_roles` before UPDATE/DELETE for the safeguards above.

Preserve and inspect these objects and all call sites before any modification. Do not replace them with the older, weaker role-check SQL merely because it exists in the review directory.

## 3. Existing authorization decisions to preserve

- Separate system roles, ministry-scoped assignments, and module/action permissions.
- A ministry-scoped `ministry_leader` assignment must never confer global Church Admin or Superadmin authority.
- Superadmin bypasses ordinary per-user permission overrides, but not authentication, approval/integrity, ministry/record scope, database constraints, audit, or protected-role safeguards.
- Prefer ministry deactivation over deletion while `user_roles.ministry_id` uses `ON DELETE CASCADE`.
- Do not infer role hierarchy from role names. Delegation remains blocked until a schema-backed hierarchy and exact assignment rules are approved.
- Ministry primary/additional leader consistency design is documented in `docs/MINISTRY_SCOPE_DESIGN.md`; reconcile it with the current schema before implementation.
- Do not seed any role/module/action permissions while the owner matrix remains PENDING.

## 4. Required open work

1. Inspect all current GitHub `supabase/review/*.review.sql` files and reconcile them against the owner-supplied live definitions/catalog output.
2. Review `docs/AUTHORIZATION_IMPLEMENTATION_GATE.md`, `docs/AUTHORIZATION_MIGRATION_DESIGN.md`, `docs/SCHEMA_RECONCILIATION.md`, and related design documents for stale environment claims or conflicting schema assumptions. Preserve historical evidence but clearly mark superseded snapshots.
3. Complete the owner-approved role/module/action/scope matrix, including the meaning of `manage`, `approve`, and `assign`.
4. Agree ministry creation, deactivation, primary/additional leader appointment, volunteer assignment, and removal workflows.
5. Design the authoritative permission resolver and transactional role/ministry assignment workflows, including RLS, grants, audit, and last-Superadmin safeguards.
6. Only after design approval, implement in small PRs and validate with disposable authenticated test users against the active test environment. No production SQL or deployment without explicit approval.

## 5. Explicit non-claims

- This inventory is not a complete application security audit.
- Owner-supplied database output has not been independently re-queried by this document.
- No permissions are approved or seeded by this inventory.
- No new RLS policy, database function, role assignment, ministry record, or production deployment is authorized by this inventory.
- A frontend route guard is not a substitute for database authorization.
