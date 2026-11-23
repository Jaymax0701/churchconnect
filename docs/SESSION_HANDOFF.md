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

## Authorization SQL review scripts prepared (2026-11-23)

- Created branch `feature/authorization-sql-review` from the then-current `main` HEAD (`889eaf8e998fcdce705c5ae6e1f35f4b48960af3`).
- Added six manual review scripts under `supabase/review/`:
  - `0014_authorization_foundation.review.sql`
  - `0015_permission_definitions_and_seeds.review.sql`
  - `0016_authorization_evaluator.review.sql`
  - `0017_ministry_assignment_workflows.review.sql`
  - `0018_override_workflows_and_rls.review.sql`
  - `0019_verification_and_review_gates.review.sql`
- The scripts reuse the live-schema authorization tables `permissions`, `role_permissions`, `roles`, and `user_roles`; they do not create a parallel role-permission engine.
- Owner-approved role/module matrix and lifecycle/delegation rules are reflected in the review scripts. Permission seeds use conflict-safe inserts and do not delete existing role mappings.
- Ministry assignments and mapping deactivation retain historical assignments; evaluator design suspends derived access when the ministry or module mapping is inactive.
- Permission overrides are permanent until changed/removed by an authorized administrator. Audit tables retain historical identifiers without cascading foreign keys.
- The branch contains six SQL files and eight commits (two follow-up hardening edits). All six files were fetched back from GitHub to verify their presence.
- GitHub compare reported branch ahead of main by eight commits and behind by zero at verification. No PR was opened.
- No SQL was executed, no Supabase schema/data was changed, and no Vercel deployment was triggered.
- Important review limitations before execution:
  - These SQL files have not been executed or validated by PostgreSQL parser against the active project.
  - Verify live `profiles.id`, `profiles.is_approved`, Auth status columns, function owners, grants, and all resource-table RLS policies.
  - The scripts establish authorization metadata/workflows but do not retrofit every existing resource table or frontend call site.
  - Review concurrency/audit behavior and SECURITY DEFINER execution ownership before approval.
- Next step: perform a line-by-line SQL/security review of the six files, correct issues on this branch, then request explicit approval before opening a PR or executing any SQL.

## Authorization SQL hardening and live-schema preflight (2026-11-23)

- GitHub now shows PR #53 (`feature/authorization-sql-review` → `main`) as merged at commit `0d28d681fe728c1fcd9ceb34f5d69242b729e1c7`. The six original review scripts are therefore present on `main`. This merge occurred outside the current tool actions; do not assume the later hardening edits were included in that merge.
- Created fresh branch `feature/authorization-sql-hardening` from the current `main` HEAD to avoid continuing on a branch that had diverged after PR #53.
- Carried forward the first-pass hardening edits to:
  - `0016_authorization_evaluator.review.sql`
  - `0017_ministry_assignment_workflows.review.sql`
  - `0018_override_workflows_and_rls.review.sql`
  - `0019_verification_and_review_gates.review.sql`
- Additional corrections on the hardening branch:
  - `0014_authorization_foundation.review.sql` now revokes table privileges from `PUBLIC` as well as `anon` and `authenticated`.
  - Ministry-scoped explicit ALLOW overrides in the evaluator now require the target user to have an assignment in that ministry, as well as an active ministry and module mapping.
  - Override workflows reject administrators modifying their own overrides, preventing self-escalation through this path.
  - Authorization audit tables have restricted SELECT policies for active, approved global Superadmins and Church Admins. Church Admin can read ministry role-assignment audit events; global role-assignment audit events remain Superadmin-only. Audit tables remain non-writable to client roles.
  - Verification script now includes the active-account helper and audit protection function.
- Added `supabase/review/0020_authorization_preflight_read_only.review.sql`, a SELECT-only catalog inspection script to verify profiles/Auth columns, current role-check function, function owners/grants, existing constraints/indexes, RLS, policies, Superadmin triggers, and table-name collisions.
- No Supabase SQL was executed. No frontend deployment was triggered. No new PR was opened for the hardening branch.
- Remaining gates:
  - The live SQL Editor results for `auth.users.deleted_at` and `auth.users.banned_until` have not yet been supplied/verified. The preflight script explicitly checks both.
  - The active live definition and owner/grants of `current_user_has_role(text)` still need confirmation from the preflight output.
  - The scripts have not been parsed/executed by PostgreSQL. A real PostgreSQL validation against a disposable clone is still required.
  - Review audit visibility policy: Church Admin can read all permission-override audit entries, while cannot change overrides for a Superadmin.
  - Resource-level RLS and frontend permission integration remain a separate implementation phase; the evaluator alone does not secure every resource table.
- Next step: user runs `0020_authorization_preflight_read_only.review.sql` in the active Supabase SQL Editor and shares the result sets. Do not execute scripts 0014–0019 until all preflight and PostgreSQL validation gates pass and the user explicitly approves execution.

## Live Supabase preflight results received (2026-11-23)

The user ran `0020_authorization_preflight_read_only.review.sql` in the active Supabase SQL Editor and supplied results. Confirmed:

- `public.profiles.id` is UUID, NOT NULL; `profiles.is_approved` is BOOLEAN, NOT NULL; `approved_at` and `approved_by` exist.
- `auth.users.id` is UUID, NOT NULL; `deleted_at` and `banned_until` both exist as nullable `timestamp with time zone`.
- The live `current_user_has_role(text)` is owned by `postgres`, SECURITY DEFINER, STABLE, has empty search_path, and checks `profiles.is_approved IS TRUE` plus a global role assignment. It does not itself check Auth ban/deletion status; the proposed `current_user_is_active_approved()` helper adds those checks.
- Existing `approve_account(uuid)` and `review_minor_registration(uuid,text)` are SECURITY DEFINER, authenticated-executable, anon-not-executable. `assert_another_active_global_superadmin(uuid)` is SECURITY DEFINER and not executable by authenticated, as expected for internal trigger use.
- Twelve modules exist and all twelve are active.
- Existing `user_roles` unique expression index is confirmed, including the all-zero UUID sentinel.
- Four last-Superadmin/canonical-role triggers are present and enabled: Auth users, profiles, roles, and user_roles.
- RLS is enabled (not forced) on all six existing authorization tables. Existing policies returned only the two profile policies shown in user output; no existing policies were reported on ministries/modules/permissions/roles/user_roles.
- All five new authorization tables are absent, as expected before migration.
- The live results confirm the expected profile/Auth columns and core schema assumptions. The user did not include the output rows from the role catalog query or the constraints query in their message; obtain those if needed before final approval.

Additional read-only checks were added to `0020_authorization_preflight_read_only.review.sql` on the hardening branch:
- Candidate function-name/signature collision inventory for scripts 0016–0018.
- Existing direct table grants on core authorization tables.
- The existing role catalog query in section 3 already reports canonical role IDs; no duplicate role query remains.

Important arithmetic correction to the earlier handoff matrix count: the approved role/module profiles in `0015` produce **37** Ministry Leader grants (one congregation view grant plus nine ministry-management modules with four grants each), not 36. Other expected totals remain Superadmin 60, Church Admin 60, Council 12, Volunteer 25, Member 13. The SQL script derives grants from the matrix; the count is a verification expectation, not hardcoded seed data.

Next: ask user to run the updated `0020` script and provide the new function-collision and direct-grant result sets, plus the role catalog if omitted. Then finish manual review and seek PostgreSQL validation in a disposable environment. Do not execute migrations or deploy.



## Catalog least-privilege review update (2026-11-23)

- User supplied the full read-only preflight outputs from 0020.
- Confirmed: existing auth.users and profiles IDs are UUID; profile approval and Auth ban/deletion columns match the SQL assumptions.
- All 12 modules exist and are active. All five new ministry-mapping, permission-override, and audit tables are absent.
- Existing role, permission, module, and assignment table structures match the reviewed assumptions. Existing unique user_roles expression index and all four last-Superadmin/canonical-role triggers are present.
- Existing RLS is enabled on all six core authorization tables; current policies shown were the two profile policies.
- Live current_user_has_role(text) is postgres-owned, SECURITY DEFINER, STABLE, empty search_path, and checks approved profile plus global role assignment.
- The pasted results did not include the role catalog rows; canonical role IDs are known from the earlier schema inventory but should still be checked against the role query before final approval.
- Critical finding: anon and authenticated currently have broad direct table privileges on public.ministries and public.modules, including INSERT/UPDATE/DELETE; modules also exposes TRUNCATE. RLS alone does not neutralize TRUNCATE.
- Created supabase/review/0021_existing_catalog_least_privilege.review.sql on feature/authorization-sql-hardening.
  - Revokes all direct client privileges from PUBLIC, anon, and authenticated on ministries/modules.
  - Restores authenticated SELECT only.
  - Adds RLS read policy: active approved Superadmin/Church Admin can read all ministry metadata; active approved ministry leaders/volunteers can read only their assigned ministry.
  - Adds RLS read policy: active approved users can read active modules; Superadmin/Church Admin can read inactive module definitions too.
  - Adds SECURITY DEFINER helper current_user_has_ministry_membership(uuid), distinct from the leader-only helper used for ministry-module mapping visibility.
  - No catalog rows are changed; no client write or anonymous access is granted.
- Updated the 0020 function-collision inventory to include current_user_has_ministry_membership(uuid).
- File created and verified by fetching it back from GitHub. No SQL was executed, no live schema/data changed, no PR opened, and no Vercel deployment triggered.
- Review caveat: before execution, verify frontend call sites for ministry/module reads and confirm server/service-role workflows retain required access. The attempted GitHub code search did not reveal direct Supabase query strings; this is not proof that no such call sites exist.
- Next step: confirm the role catalog output and complete a final line-by-line review of 0021 plus migration dependencies. PostgreSQL parser/behavior validation against a disposable clone remains outstanding. Do not execute SQL or open a PR unless explicitly approved.
