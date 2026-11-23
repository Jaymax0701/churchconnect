# ChurchConnect Session Handoff

Last updated: 2026-11-22
Current workstream: Ministry Management, Roles, and Permissions
Repository: `Jaymax0701/churchconnect`
Base branch: `main`
Base commit: `bca4394d69afb3ba9e988d751fdc096b577ba490` (PR #51 merge)
Current documentation branch: `docs/ministry-roles-permissions-handoff` (follow-up commits after PR #51 merge)

## Working agreement

- Inspect tracked repository content through the connected GitHub repository before asking the owner to run local file-reading commands.
- Ask for local PowerShell output only when local runtime, uncommitted files, or environment-specific behavior must be verified.
- Keep work incremental and reviewable.
- Never merge a PR, apply SQL, deploy Edge Functions, or deploy the frontend without explicit owner approval.
- Update this handoff and relevant Markdown documentation at the end of each substantive session.

## Current focus and findings

### Frontend
- `src/routes/AppRoutes.tsx` protects portal/admin routes with `RequireApprovedUser`; the admin route is additionally protected by `RequireSuperadmin`.
- `RequireSuperadmin` calls `current_user_has_role('superadmin')` and fails closed on RPC error or false.
- Admin routes currently registered: `/admin` and `/admin/users`.
- Desktop/mobile navigation exposes Ministries, Events & Services, and Permission Matrix as hash anchors, not working pages/routes.
- `AdminDashboardPage` handles pending account approvals and minor reviews through RPCs; it should remain separate from ministry/role management.
- `UserAccountsPage` uses `list_user_accounts` and the `admin-manage-user` Edge Function for account management.
- No general-purpose frontend permission resolver/helper or use of `role_permissions`, `permissions`, or ministry-scoped `user_roles` was found in the tracked `src` search.
- AdminLayout currently hardcodes the SUPERADMIN badge; role-aware display should be considered with RBAC UI.

### Database (owner-supplied SQL/catalog evidence, 2026-11-22)
- Existing tables: `ministries`, `modules`, `permissions`, `role_permissions`, `roles`, `user_roles`.
- Six system roles and twelve canonical modules exist.
- `ministries`, `permissions`, `role_permissions` are empty; roles/modules are seeded; one global Superadmin assignment exists.
- `permissions` and `role_permissions` are empty.
- All six tables have RLS enabled and no policies were reported.
- `anon`/`authenticated` have table grants on ministries/modules; no direct client grants were reported on permissions, role_permissions, roles, user_roles. Do not infer access from grants alone.
- `user_roles` lacks a unique constraint preventing duplicate user/role/scope assignments.
- Existing functions/triggers protect canonical Superadmin role integrity and the last active approved global Superadmin. Preserve them.

### Repository and local environment
- GitHub `main` was confirmed at `bca4394d69afb3ba9e988d751fdc096b577ba490` after PR #51 merged. Local checkout may still be at the earlier `155b94f`; verify before local testing.
- GitHub has `supabase/review/` scripts and `supabase/functions/`; no `supabase/migrations/` directory was found in the local tree.
- Local-only untracked paths reported by owner: `openai-audit/` and `supabase/.temp/`. Do not delete, stage, or commit these without inspection and owner approval.
- Review SQL is manual/review-only and must not be applied without explicit approval.

## Existing design documents to reconcile, not rewrite from scratch

- `docs/AUTHORIZATION_REVIEW_FINDINGS.md`
- `docs/AUTHORIZATION_IMPLEMENTATION_GATE.md`
- `docs/AUTHORIZATION_MIGRATION_DESIGN.md`
- `docs/AUTHORIZATION_BEHAVIORAL_TEST_PLAN.md`
- `docs/ROLE_MODULE_PERMISSION_MATRIX.md`
- `docs/MINISTRY_SCOPE_DESIGN.md`
- `docs/SCHEMA_RECONCILIATION.md`
- `docs/PERMISSIONS.md`

The role/module/action matrix remains pending. No permission grants should be inferred or seeded.

## Additional repository review completed

- Inspected the full `supabase/review/` directory listing on GitHub. It contains numbered manual SQL review files (0001–0013, with two duplicated sequence numbers); there is no dedicated ministry/RBAC implementation script in that directory.
- Read `0001_account_foundation.review.sql`: it is an old empty-database preflight and explicitly aborts if profiles/auth users or approval columns already exist. It must not be rerun against the current populated project.
- Read `0002_global_role_check.review.sql`: its function body does not check `profiles.is_approved`, unlike the current owner-supplied live function. Reapplying it would weaken the role gate; do not run it.
- Read `.agents/rules/security.md`: it contained stale role IDs (`ADMIN`, `SUPERADMIN`), an obsolete additive-only permission rule, and a simplistic superadmin description. Updated it on this documentation branch to align with canonical role IDs, explicit-deny precedence, ministry scope, GitHub-first inspection, and approval safeguards.
- GitHub code search found the proposed `role_module_permissions`, `user_module_permissions`, and `has_module_permission()` in design documentation only; no implementation references in current tracked frontend code were found. The live schema evidence supplied by the owner also does not include these proposed tables/functions.

## Further authorization-document reconciliation (2026-11-22)

- Read `docs/PERMISSIONS.md`, `docs/ROLE_MODULE_PERMISSION_MATRIX.md`, `docs/SCHEMA_RECONCILIATION.md`, `docs/MINISTRY_SCOPE_DESIGN.md`, `docs/AUTHORIZATION_MIGRATION_DESIGN.md`, `docs/AUTHORIZATION_REVIEW_FINDINGS.md`, `docs/AUTHORIZATION_IMPLEMENTATION_GATE.md`, and `docs/AUTHORIZATION_BEHAVIORAL_TEST_PLAN.md`.
- Found that `PERMISSIONS.md` contains conceptual engine rules that include confirmed precedence decisions, but its proposed permission tables/functions are not in the current live schema. It also contains uppercase role-ID examples and refers to `ministries.leader_id`, neither of which should be treated as current implementation.
- `MINISTRY_SCOPE_DESIGN.md` proposes both `ministries.leader_id` and ministry-scoped `user_roles` for primary/additional leaders. The owner has not confirmed this dual-source model. Current live inventory confirms only ministry-scoped `user_roles`; do not add `leader_id` without an explicit decision.
- `SCHEMA_RECONCILIATION.md`, `AUTHORIZATION_MIGRATION_DESIGN.md`, and `AUTHORIZATION_IMPLEMENTATION_GATE.md` describe the 2026-10 non-production staging snapshot and must not be used as current live-project instructions.
- `AUTHORIZATION_REVIEW_FINDINGS.md` and `AUTHORIZATION_MIGRATION_DESIGN.md` still describe login as a demo flow; that is superseded by the current real Supabase Auth implementation. End-to-end authorization behavior still needs testing with real user sessions.
- Added reconciliation banners to these historical docs on this branch; no historic SQL was modified and no SQL was executed.

## Next exact steps

1. Inspect the live definitions and all mutation paths for roles, user_roles, profile approval/status, and Auth-user deletion; confirm exactly which trigger/function safeguards run on each path.
2. Decide the ministry leadership model: (A) ministry-scoped `user_roles` only, or (B) one primary leader via `ministries.leader_id` plus optional additional leaders in `user_roles`. Do not add a second source of truth before this is decided.
3. Decide whether the permission engine will retain legacy `permissions`/`role_permissions` as the active engine or introduce `role_module_permissions`/`user_module_permissions`; current live schema only confirms the legacy tables.
4. Define `view/create/update/delete` and whether `manage`, `approve`, and `assign` are separate capabilities; then complete the 6-role × 12-module matrix. All grants remain pending until explicitly approved.
5. Inspect real frontend queries/RPCs and public-site data sources, then design narrow grants, RLS policies, and trusted transactional admin RPCs.
6. Verify last-active-Superadmin protection across user_roles mutation, profile approval/deletion, role mutation/deletion, and Auth-user cascade paths, including concurrent transactions.
7. Only after these decisions are agreed, prepare implementation SQL and tests. No SQL execution, merge, or deployment without explicit approval.

## Work completed in this session

- Confirmed GitHub `main` HEAD is `155b94ff22ae52760da09d4f61df1117c2f1aaf2`, matching the local branch/commit reported by the owner.
- Retrieved current repository documentation and route/auth files directly from GitHub.
- Identified stale 2026-10-28 authorization inventory claims and documented current frontend/database evidence.
- Created a documentation-only branch; no application code, SQL, database, or deployment changes were made.

## Authorization SQL review scripts and first-pass security review (2026-11-23)

- Working branch: `feature/authorization-sql-review`.
- Six review-only SQL files are present under `supabase/review/`:
  - `0014_authorization_foundation.review.sql`
  - `0015_permission_definitions_and_seeds.review.sql`
  - `0016_authorization_evaluator.review.sql`
  - `0017_ministry_assignment_workflows.review.sql`
  - `0018_override_workflows_and_rls.review.sql`
  - `0019_verification_and_review_gates.review.sql`
- These use the existing authorization tables `permissions`, `role_permissions`, `roles`, and `user_roles`; they do not introduce a parallel role-permission engine.
- The owner-approved role/module matrix, ministry lifecycle, delegation, permanent override, and historical audit retention decisions are reflected in the scripts.
- First-pass review corrections committed:
  - Added `current_user_is_active_approved()` and used it to gate privileged RPCs and ministry mapping reads.
  - Restricted the ministry mapping read helper to ministry leaders, consistent with the approved governance.
  - Added active/approved actor checks to ministry role removal and ministry-module activation/deactivation.
  - Reworked permission override audit classification to use the actual prior row state, rather than infer it from the last audit event.
  - Serialized override changes per target Auth user to reduce audit-state races between concurrent set/remove operations.
  - Added UPDATE/DELETE rejection triggers for the three authorization audit tables.
  - Corrected the canonical role grant verification count and added checks for audit triggers and the existing all-zero UUID sentinel used by the user_roles unique expression index.
- All six SQL files were fetched back from GitHub after edits. Script 0019 is intentionally read-only and has no transaction wrapper.
- GitHub branch comparison after review edits reported four commits ahead and one commit behind `main`. Main advanced after this branch was created; inspect the changed history and reconcile the branch before opening a PR. No PR has been opened.
- No SQL was executed, no Supabase schema/data was changed, and no Vercel deployment was triggered.
- Remaining pre-execution gates:
  - Confirm live `profiles.id`, `profiles.is_approved`, `auth.users.deleted_at`, and `auth.users.banned_until` columns and types.
  - Confirm `current_user_has_role()` behavior, function signatures/owners, grants, and SECURITY DEFINER ownership.
  - Run a PostgreSQL syntax/semantic validation against a disposable clone or test database.
  - Review whether audit-log read access should be provided through a restricted admin RPC; direct client access is intentionally not granted.
  - Remember that audit UPDATE/DELETE triggers are not a substitute for restricting table ownership, TRUNCATE, trigger disabling, or superuser access.
  - Inventory and implement resource-level RLS and frontend authorization call sites separately; these six scripts do not retrofit all application data tables.
- Next step: resolve the remaining schema and PostgreSQL validation gates, then request explicit approval before opening a PR or executing any SQL.
