# ChurchConnect Session Handoff

Last updated: 2026-11-24
Current workstream: Ministry Management, Roles, and Permissions
Repository: `Jaymax0701/churchconnect`
Base branch: `main`
Current working branch: `feature/authorization-sql-hardening`
Current focus: static SQL security review and disposable PostgreSQL validation; all SQL remains review-only

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
- The role catalog output was subsequently supplied: all six canonical IDs (`superadmin`, `church_admin`, `church_council`, `ministry_leader`, `ministry_volunteer`, `member`) exist and all six are marked `is_system = true`.
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
- The updated 0020 function-collision query returned no rows. The role catalog query confirmed the six canonical IDs, all system roles.
- Constraint/index output confirms the expected permission action/scope checks, permission uniqueness, foreign keys, role-permission primary key, and existing `user_roles_unique_assignment` expression index using the all-zero UUID sentinel. No duplicate unique index is needed.
- The live RLS inventory confirms RLS enabled (not forced) on all six existing authorization tables; only the two profile policies were returned. No policies currently exist on ministries/modules/permissions/role_permissions/roles/user_roles.
- The complete constraints output confirms `user_roles.ministry_id` references `ministries(id) ON DELETE CASCADE`; ministry deactivation, rather than deletion, remains the intended lifecycle approach.
- The direct-grant query confirms `anon` and `authenticated` both currently have INSERT, SELECT, UPDATE, DELETE, REFERENCES, and TRIGGER on `ministries`; `modules` has those privileges plus TRUNCATE. This is a live critical exposure, not merely a theoretical concern. Script 0021 is intended to revoke all these direct client privileges and restore authenticated SELECT subject to RLS.
- The updated 0020 function-collision query returned no rows, including no collision for `current_user_has_ministry_membership(uuid)`. The role catalog query confirmed the six canonical IDs, all system roles.
- Remaining next steps: complete a line-by-line security review of 0021 and its dependency order; inspect all frontend ministry/module reads and server/service-role workflows; then obtain PostgreSQL syntax/behavior validation against a disposable clone. Do not execute SQL or open a PR unless explicitly approved.


## Complete live preflight confirmation (2026-11-23)

The owner supplied the remaining role-catalog, constraint/index, and updated function-collision results from the read-only 0020 preflight.

- Canonical role catalog confirmed:
  - `church_admin` / Church Admin / system
  - `church_council` / Church Council / system
  - `member` / Church Member / system
  - `ministry_leader` / Ministry Leader / system
  - `ministry_volunteer` / Ministry Volunteer / system
  - `superadmin` / Superadmin / system
- Updated function collision inventory returned no rows.
- Existing constraints and indexes match the SQL review assumptions:
  - permission actions: view/create/update/delete/manage/approve/assign
  - permission scopes: global/assigned_ministry/self
  - unique permission key: (module_id, action, scope)
  - user_roles scope check: global requires NULL ministry_id; ministry requires non-NULL ministry_id
  - user_roles ministry FK uses ON DELETE CASCADE
  - unique user_roles expression index includes COALESCE(ministry_id, all-zero UUID)
- All five new authorization tables remain absent.
- The direct-grant inventory confirms broad anon and authenticated privileges on ministries and modules. Both have INSERT/SELECT/UPDATE/DELETE/REFERENCES/TRIGGER; modules also has TRUNCATE. This remains unresolved until an approved execution of the reviewed remediation. RLS is enabled but not forced, and no policies were returned for these catalog tables.
- RLS is enabled on the six existing authorization tables. Existing policy inventory returned only profiles_select_own and profiles_update_own_name.
- All four Superadmin/canonical-role protection triggers are enabled.
- The full live schema preflight now has the role catalog and constraints/indexes outputs; these are no longer outstanding information requests.

## Outstanding review gates after complete preflight

1. Line-by-line review of 0021, including helper ownership, function execution grants, RLS policy semantics, and dependency on 0016's active-approved helper.
2. Comprehensive inspection of frontend ministry/module reads and any server/service-role workflows. The earlier inspection of AdminDashboardPage.tsx and UserAccountsPage.tsx alone is not sufficient.
3. PostgreSQL parser and behavior validation against a disposable clone/test database. No such validation has yet occurred.
4. Confirm migration order and dependencies for scripts 0014–0019 followed by 0021, and verify any required grants for trusted server workflows.
5. Resource-level RLS and frontend permission enforcement remain separate future work; do not imply these scripts secure every application resource.

No SQL has been executed. No live schema/data changed. No PR has been opened for the hardening branch, and no Vercel deployment has been triggered. Explicit owner approval is still required for any of those actions.


## 2026-11-24 — 0021 application call-site review

- Reviewed all tracked frontend TypeScript/TSX files on `feature/authorization-sql-hardening` using the GitHub repository tree and file contents.
- No frontend query or RPC was found that reads `public.ministries` or `public.modules`. The Ministry and Permission Matrix navigation items remain placeholder hash links; no corresponding management pages are registered.
- Existing frontend authorization RPC calls are limited to `current_user_has_role` in route/layout gates and account-management RPCs (`list_pending_accounts`, `approve_account`, `review_minor_registration`, `list_user_accounts`). No frontend use of `role_permissions`, `permissions`, or ministry-scoped `user_roles` was found.
- Inspected both deployed Edge Function source files. `admin-manage-user` uses a service-role client for a `user_roles` lookup; `secure-login` uses privileged clients for authentication operations. Neither currently reads `ministries` or `modules`.
- This reduces the likelihood that 0021 breaks an existing catalog read path, but does not prove every future or external server integration is covered.
- 0021 review observations: its new membership helper is SECURITY DEFINER with an empty search_path, accepts only a ministry ID (caller identity comes from `auth.uid()`), checks active/approved status, and limits membership to ministry_leader/ministry_volunteer assignments. Its execution grants are revoked from PUBLIC/anon and restored to authenticated. Its effective owner will be the role executing the script; confirm that this is the trusted database owner (normally postgres in Supabase SQL Editor) before any future execution.
- Remaining check before calling 0021 execution-ready: inspect effective/direct `service_role` privileges and table owners for `ministries` and `modules`, and verify whether any external server/service integration reads these tables. Existing preflight output only listed anon/authenticated grants and did not establish service_role's effective privileges.
- SQL parser/semantic validation against a disposable PostgreSQL database remains outstanding. No SQL was executed, no database changes were made, no PR was opened, and no deployment was triggered.


## 2026-11-24 — service-role privilege review completed

- Owner supplied the effective direct privilege results for `service_role` on the existing catalog tables:
  - `public.ministries`: owner `postgres`; SELECT, INSERT, UPDATE, DELETE granted; TRUNCATE not granted.
  - `public.modules`: owner `postgres`; SELECT, INSERT, UPDATE, DELETE, TRUNCATE granted.
- This confirms the reviewed 0021 revocations, which target `PUBLIC`, `anon`, and `authenticated`, do not revoke the separately granted `service_role` privileges shown in the preflight results.
- Both catalog tables are owned by `postgres`. The new SECURITY DEFINER membership helper's owner will be the role that executes 0021; if execution is ever approved, the intended execution role is `postgres` so ownership aligns with the existing table-owner pattern.
- Frontend and currently tracked Edge Function inspection found no existing ministry/module catalog reads. The `admin-manage-user` Edge Function does read `user_roles` using service role, but does not read either catalog table. External and future integrations remain outside the inspected repository evidence.
- Service-role/table-owner review is now confirmed; it is no longer an outstanding preflight request.
- **0021 is still not execution-ready.** PostgreSQL syntax and semantic validation against a disposable database has not been performed. RLS behavior also still requires test coverage for Superadmin, Church Admin, ministry leaders, volunteers, ordinary members, and anon, including verification of helper ownership/grants and effective table privileges.
- No SQL was executed, no live schema/data changed, no PR was opened, and no Vercel deployment was triggered. The broad live `anon`/`authenticated` grants on ministries/modules therefore remain in place until a separately approved remediation is validated and executed.

## Current review gate status (2026-11-24)

| Review area | Status |
|---|---|
| Live schema, canonical roles, constraints and indexes | Confirmed |
| Function collision check | Passed; no unexpected collisions returned |
| Frontend ministry/module catalog call sites | No conflicting reads found in tracked frontend |
| Existing Edge Function catalog dependencies | No ministry/module reads found |
| `service_role` direct privileges and catalog table owners | Confirmed |
| 0021 helper design and privilege intent | Initial manual review passed; owner depends on execution role |
| PostgreSQL syntax/semantic validation on disposable database | Outstanding |
| RLS behavior matrix and effective privilege verification | Outstanding |

**Current conclusion:** Keep 0021 and scripts 0014–0019 as review-only artifacts. Do not execute against the active Supabase project. Do not open a PR or deploy unless the owner explicitly approves those separate actions. The current work has not fixed the live catalog grants; it has only prepared and reviewed a proposed remediation.


## 2026-11-24 — first static concurrency review

- Re-fetched the current 0014–0021 review scripts from `feature/authorization-sql-hardening` before review. The files remain review-only and were not executed.
- Confirmed the current assistant/container environment has no `psql`, PostgreSQL server, Docker, Podman, `pglast`, `sqlglot`, or PostgreSQL driver installed. Therefore no PostgreSQL parser run or disposable-database execution has been performed. Do not report syntax validation as passed.
- Initial static review of 0016–0018 found a concurrency/authorization race requiring correction before the scripts can be considered ready:
  - `assign_ministry_role` checks actor and target active/approved status, ministry activity, and Ministry Leader authority using ordinary reads, then inserts the assignment. It does not lock the actor/target Auth and profile rows, the ministry row, or the leader's qualifying `user_roles` row while the decision is in progress.
  - `remove_ministry_role` locks the target assignment row, but does not lock the acting Ministry Leader's qualifying assignment or active ministry row while checking delegated authority.
  - A concurrent account-status change, ministry deactivation, or removal of the acting leader's assignment could therefore race with the authorization check. The existing unique assignment index prevents duplicate assignment rows, but does not solve this time-of-check/time-of-use authorization race.
- Required correction: define and implement a consistent lock order for actor/target account status, ministry state, and delegated leader assignment; then test concurrent revocation/deactivation versus assignment/removal in a disposable PostgreSQL environment. Review potential deadlocks against the existing global-role and Superadmin guard paths before choosing the lock order.
- Other initial observations:
  - 0018 override set/remove paths use the target Auth user row as a serialization lock and then lock the override row, which is a useful consistent pattern to preserve.
  - 0017 mapping activation/deactivation locks an existing mapping row; simultaneous first-time creation is protected from duplicate rows by the mapping primary key, though one concurrent caller may receive a unique-violation error and should be tested.
  - 0019 contains a literal backslash-n sequence in one checklist comment; cosmetic only, not executable SQL.
- This was an initial static review, not a complete line-by-line certification of every script. 0014, 0015, 0020, and 0021 still require complete syntax/semantic validation and the full RLS behavior matrix.
- No repository SQL file was changed in this review step. No SQL was executed, no live database changed, no PR was opened, and no deployment was triggered.


## 2026-11-24 — 0017 concurrency hardening revision

- Updated `supabase/review/0017_ministry_assignment_workflows.review.sql` on the hardening branch to address the previously identified authorization time-of-check/time-of-use race.
- `assign_ministry_role` now:
  - Locks actor and target `auth.users` rows in deterministic UUID order.
  - Locks corresponding `profiles` rows in deterministic UUID order.
  - Rechecks actor and target active/approved status while those locks are held.
  - Locks the ministry row `FOR SHARE` while checking active status, preventing concurrent ministry deactivation from racing the authorization decision.
  - Locks the actor's qualifying global role rows and, for delegated Ministry Leader authority, the qualifying ministry-leader assignment row `FOR SHARE`.
- `remove_ministry_role` now:
  - Reads assignment identifiers without locking, then acquires account/profile locks in deterministic UUID order, followed by the ministry row lock and assignment row lock.
  - Rechecks actor active/approved status after acquiring account/profile locks.
  - Re-reads and locks the assignment after earlier locks are acquired, and rejects if the assignment's target user or ministry identity changed while waiting.
  - Locks the actor's qualifying global role row(s), or the qualifying Ministry Leader assignment row, before relying on that authority.
  - Allows global administrators to remove assignments from inactive ministries, while delegated Ministry Leaders may remove volunteers only in an active ministry.
- Expanded the 0017 review gates to require concurrency tests covering account suspension/approval revocation, ministry deactivation, leader removal, concurrent assignment/removal, lock-order/deadlock behavior, duplicate assignment handling, and audit atomicity.
- GitHub verification confirmed the updated file contains the intended deterministic account/profile locks, ministry and leader-assignment share locks, assignment identity recheck, expanded gates, and unchanged manual-review-only warning.
- **Important limitation:** this is a static design correction only. No PostgreSQL parser or disposable PostgreSQL execution has validated syntax, lock semantics, transaction behavior, or deadlock behavior. The concurrency finding is addressed in the proposed SQL design but is not yet proven closed.
- The change does not alter the approved governance matrix or ministry assignment authority. No SQL was executed, no active Supabase schema/data changed, no PR was opened, and no deployment was triggered.

## Updated authorization hardening status (2026-11-24)

| Area | Status |
|---|---|
| 0017 proposed concurrency controls | Revised; static review only |
| 0017 syntax and semantic validation | Outstanding |
| 0017 concurrent transaction/deadlock tests | Outstanding |
| Full 0014–0021 PostgreSQL validation | Outstanding |
| Full RLS behavior matrix | Outstanding |
| Active Supabase project changes | None |
| PR/deployment | None |

Keep all scripts review-only until disposable PostgreSQL validation and the complete security/RLS test matrix pass, and until the owner separately approves any execution or deployment.


## 2026-11-24 — follow-up concurrency hardening for 0017–0018

- Continued static review of the complete review-script set (0014–0021) on feature/authorization-sql-hardening. No SQL was executed.
- Found an additional time-of-check/time-of-use gap in the permission override workflows: the actor's account/profile state and global administrator role were checked without holding locks that serialize concurrent account suspension/approval revocation or global-role removal.
- Updated supabase/review/0018_override_workflows_and_rls.review.sql:
  - set_user_permission_override now locks actor and target Auth-user rows in deterministic UUID order, then corresponding profile rows; rechecks actor active/approved status; locks qualifying global Superadmin/Church Admin role rows before rechecking authority; and locks an existing target Superadmin assignment before applying the Church Admin restriction.
  - remove_user_permission_override now uses the same deterministic actor/target account and profile lock order, rechecks actor active/approved status, locks qualifying actor global-role rows before rechecking authority, and locks an existing target Superadmin assignment before applying the restriction.
  - Added behavioral review gates for concurrent actor suspension/approval revocation, global-role removal, target Superadmin-role removal, and reversed actor/target override operations.
- Continued review of set_ministry_module_active in supabase/review/0017_ministry_assignment_workflows.review.sql and found the same missing actor-authority serialization. It now locks the actor Auth-user and profile rows, rechecks active/approved status, locks qualifying global administrator role rows, and rechecks Superadmin/Church Admin authority before changing mappings.
- Hardened concurrent first-time ministry-module activation: uses the mapping primary key with ON CONFLICT DO NOTHING, then re-reads/locks the existing mapping; only the transaction that creates the row writes the initial activation audit event.
- Expanded 0017 behavioral review gates for concurrent first-time mapping activation and administrator-role revocation during mapping changes.
- GitHub updates and read-back verification:
  - 0017 latest commit: a341312691dbcaada751429d82bdb70202c0c20b; latest content SHA: 6d3986c1aefadf3d2cc7cdd1fa0832cb24a9a70c.
  - 0018 latest commit: 0926496e6961f410dfce5ecda3a85422f0fccbf1; latest content SHA: f4772f10d60ccb4be178180cf363d1177cadf0d7.
  - 0017 mapping hardening was committed in 6e37ad8382246f434e2520005247fbe3c55af6b3 before its review-gate follow-up.
  - 0018 actor/target lock hardening was committed in 0b042aa47d4463bdbc72ba301aafed39c3e11f8b before its review-gate follow-up.
- Remaining concurrency caveat: locking an existing target Superadmin assignment stabilizes its removal, but a concurrent insertion/promotion of the target into the Superadmin role must also be serialized by the global-role assignment/bootstrap path (for example, by taking the same target Auth-user lock). Repository inspection found no current global-role assignment RPC or frontend workflow; docs/FIRST_SUPERADMIN_BOOTSTRAP.md describes a trusted one-time bootstrap as design-only, and the referenced operations SQL template is absent from this branch. Therefore the actual assignment path is not verified. The 0018 review gate now explicitly requires every global Superadmin assignment/bootstrap path to take the same target Auth-user lock and tests concurrent promotion/removal against override mutation.
- A subsequent lock-order review found that 0018 set/remove override workflows acquired the target Superadmin role row and override row in opposite orders, creating a possible deadlock for concurrent set/remove operations on the same target. Updated remove_user_permission_override to lock the target Superadmin assignment before the override row, matching set_user_permission_override, and added a dedicated concurrent set/remove regression gate. Latest 0018 commit: 3d55fd2dd8ba0ed1425b579e60676a568a52e89c; content SHA: a91324bea2762a193ee599aa39d566c6a816757a.
- These are proposed SQL design changes only. The environment still has no psql, PostgreSQL server, Docker, Podman, pglast, sqlglot, or PostgreSQL driver. PostgreSQL syntax/semantic validation, lock behavior, transaction tests, and deadlock tests remain outstanding.
- No SQL was executed; no active Supabase schema/data changed; no PR was opened; no Vercel deployment was triggered.

## 2026-11-24 — continued static review and local validation attempt

- Attempted to establish a disposable local PostgreSQL environment in the isolated Debian 13 container. No PostgreSQL binaries, Docker/Podman, psql, or parser packages were initially available.
- Attempted system package installation through apt and Python installation of pglast. Both were blocked by unavailable DNS/network access. No packages were installed and no database was started.
- Therefore executable PostgreSQL parsing, schema application, RLS testing, and transaction/concurrency testing remain unavailable in this environment. Do not substitute the active Supabase project.
- Continued static review of 0014–0019 and 0021:
  - Confirmed ministry_module_audit is created at the beginning of 0017, before 0018 adds its SELECT policy and append-only trigger; the dependency order is correct.
  - Confirmed 0018's mapping visibility helper is leader-only (per 0016 current_user_has_ministry_assignment), consistent with the approved governance that volunteers cannot view ministry-module mappings. Corrected the 0018 explanatory comment to say Ministry Leaders only.
  - 0015 seeds only canonical role grants and does not remove existing grants; owner-supplied preflight previously showed role_permissions empty, but this must be rechecked in a disposable clone before execution.
  - 0021 helper/policies remain dependent on 0016 and existing roles/user_roles; the live broad grants on ministries/modules remain unresolved.
- Latest 0018 comment clarification commit: 4ed080e5245a6866fb639ed66129f2f55b477b5f; content SHA: 2b3576c1d1509a8f516576d891e93814fbb5f005.
- Static review is not equivalent to SQL syntax or runtime validation. No SQL was executed; no Supabase changes, PR, merge, or deployment occurred.

## Current next steps

1. Complete line-by-line static review of all eight scripts (0014–0021), including transaction boundaries, function ownership/EXECUTE grants, lock ordering, role lifecycle and RLS semantics.
2. Inspect the actual global-role assignment/bootstrap and role-revocation paths to verify whether they share the target Auth-user lock required to serialize Superadmin promotion against override administration.
3. Find or provision a disposable PostgreSQL validation environment. Do not use the active Supabase project for parser or behavior tests.
4. Validate scripts 0014–0019 and 0021 in dependency order; test SQL syntax, grants, SECURITY DEFINER ownership, RLS behavior, concurrency, deadlocks, audit atomicity, and existing last-Superadmin safeguards.
5. Keep the live ministries/modules grant exposure documented as unresolved until a separately approved and validated remediation is executed. The proposed 0021 script is not applied.
6. Do not open a PR, execute SQL, merge, or deploy without explicit approval.

## Updated review status (2026-11-24)

| Area | Status |
|---|---|
| Live schema, canonical roles, constraints/indexes | Confirmed from owner-supplied preflight |
| Frontend and tracked Edge Function ministry/module catalog call sites | No conflicting reads found |
| Existing service_role grants and catalog table owners | Confirmed |
| 0017 actor/target/ministry/delegated-role lock design | Revised; static review only |
| 0017 mapping activation concurrency handling | Revised; static review only |
| 0018 actor/target account and global-role lock design | Revised; static review only |
| 0018 target Superadmin promotion/removal serialization | Promotion path still to inspect |
| PostgreSQL syntax/semantic validation | Outstanding |
| RLS behavior matrix and effective privilege tests | Outstanding |
| Active Supabase changes | None |
| PR / merge / deployment | None |

**Current conclusion:** The latest changes improve the proposed concurrency controls, but none of the concurrency findings is proven closed until PostgreSQL validation and transaction-level tests pass. All scripts remain manual-review artifacts. The active Supabase catalog grants have not been remediated.


## 2026-11-25 — global Superadmin assignment path inspection

- Continued the remaining static review of the Superadmin promotion/removal path, specifically the target Auth-user lock required by the Church Admin restriction in 0018.
- Re-fetched and inspected the current hardening-branch files:
  - `docs/FIRST_SUPERADMIN_BOOTSTRAP.md`
  - `docs/AUTHORIZATION_APPLICATION_INVENTORY.md`
  - `docs/TRUSTED_ADMIN_WORKFLOW_INVENTORY.md`
  - `docs/DECISIONS.md`
  - `supabase/review/0004_admin_account_approval.review.sql`
  - `supabase/review/0009_pdpa_dob_consent_and_minor_review.review.sql`
  - `supabase/review/0016_authorization_evaluator.review.sql`
  - `supabase/review/0017_ministry_assignment_workflows.review.sql`
  - `supabase/review/0018_override_workflows_and_rls.review.sql`
  - `supabase/review/0019_verification_and_review_gates.review.sql`
- Findings from tracked repository content:
  - 0017 writes only ministry-scoped `ministry_leader` / `ministry_volunteer` assignments. It does not assign global roles.
  - 0018 changes permission overrides only; it does not assign global roles.
  - 0004 and 0009 inspect Superadmin authority for approval/minor-review workflows but do not create or promote global role assignments.
  - The frontend inventory reports no role-assignment UI. The trusted workflow inventory still classifies role assignment/revocation as not implemented in the inspected UI and marks deployed/admin-script paths as requiring further evidence.
  - `docs/FIRST_SUPERADMIN_BOOTSTRAP.md` describes a trusted one-time bootstrap concept, but the referenced separate manual bootstrap SQL template is absent from the inspected branch. The document itself is design-only and explicitly says no database changes were performed.
  - The owner-supplied live trigger inventory identifies protection triggers on `roles` and `user_roles` for UPDATE/DELETE, plus Auth-user/profile safeguards. This does not establish that every trusted global-role promotion path takes the same target `auth.users` row lock used by 0018.
- Conclusion: the target Superadmin promotion/bootstrap path remains **unverified**. There is no tracked global-role assignment RPC or frontend workflow to inspect, and the documented bootstrap template is missing. Do not treat the 0018 target-Superadmin concurrency caveat as closed.
- Required evidence before closing this gate:
  1. Locate the exact trusted SQL/bootstrap operation or other server-side path that inserts a global `superadmin` assignment.
  2. Inspect all global role INSERT/UPDATE/DELETE paths, including trusted dashboard/manual operations and any deployed functions not represented in tracked source.
  3. Confirm the promotion path locks the target `auth.users` row using the same lock order as 0018 before creating the Superadmin assignment; test promotion/removal against concurrent override set/remove operations.
  4. Confirm the existing last-active-Superadmin synchronization mechanism covers all promotion, demotion, profile, Auth deletion/cascade, and role mutation paths.
- No SQL or application code was changed in this review step. No SQL was executed, no live Supabase schema/data changed, no PR was opened, and no deployment was triggered.

## Updated review status (2026-11-25)

| Area | Status |
|---|---|
| Live schema, canonical roles, constraints/indexes | Confirmed from owner-supplied preflight |
| Frontend and tracked Edge Function ministry/module catalog call sites | No conflicting reads found |
| Existing service_role grants and catalog table owners | Confirmed |
| 0017 assignment/mapping lock design | Revised; static review only |
| 0018 override actor/target lock order | Revised; static review only |
| 0018 target Superadmin promotion serialization | **Unverified; trusted bootstrap SQL template/path not found** |
| Full global-role assignment/revocation path inventory | Outstanding |
| PostgreSQL syntax/semantic validation | Outstanding; local environment could not obtain PostgreSQL tooling |
| RLS behavior matrix, transaction/concurrency/deadlock tests | Outstanding |
| Active Supabase changes | None |
| PR / merge / deployment | None |

**Current conclusion:** The proposed scripts remain review-only. The global Superadmin promotion path is not sufficiently evidenced to certify the 0018 concurrency restriction, and PostgreSQL runtime validation remains unavailable. Do not execute SQL, open a PR, merge, or deploy until the outstanding evidence and validation gates pass and the owner separately approves the relevant action.


## 2026-11-25 — live Superadmin protection definitions reviewed

- Owner supplied the current live trigger definitions and all function definitions matching the read-only inventory query.
- Confirmed live protection objects:
  - `auth.users`: BEFORE DELETE OR UPDATE OF `deleted_at, banned_until` trigger `guard_last_global_superadmin_auth_user`.
  - `public.profiles`: BEFORE DELETE OR UPDATE OF `is_approved` trigger `guard_last_global_superadmin_profile`.
  - `public.user_roles`: BEFORE UPDATE OR DELETE trigger `guard_last_global_superadmin_role`.
  - `public.roles`: BEFORE UPDATE OR DELETE trigger `guard_canonical_superadmin_role`.
  - All four trigger functions are SECURITY DEFINER with empty search_path and owned by postgres (per supplied function inventory).
- `assert_another_active_global_superadmin(uuid)` is SECURITY DEFINER, postgres-owned, and obtains `FOR UPDATE` on the canonical `public.roles` row where `id = 'superadmin'`, then requires another approved, active, non-deleted, non-banned global Superadmin excluding the target user.
- The protection triggers cover the listed destructive/invalidation events for existing global Superadmin assignments. The canonical role guard prevents deletion and key identity mutation of the canonical Superadmin role.
- These definitions do not provide a global-role assignment workflow. The supplied function inventory contains no tracked function that inserts a global Superadmin assignment; ministry assignment workflows are separate and scoped to ministry roles. The exact trusted bootstrap/manual insertion operation remains unlocated.
- Static lock-order concern for further PostgreSQL concurrency testing: the `user_roles` BEFORE DELETE/UPDATE guard obtains the canonical role-row lock while the target assignment row is already being modified. An `auth.users` DELETE obtains the Auth-user row lock and invokes its own guard (which obtains the canonical role-row lock) before the FK cascade reaches `user_roles`. A concurrent direct assignment deletion and Auth-user deletion for the same user may therefore acquire the assignment/role locks in opposite orders, depending on interleaving. This is a **potential deadlock to reproduce or rule out**, not a confirmed runtime defect. Include independent-session tests for Auth-user deletion versus direct role deletion/update, alongside profile approval revocation and multiple concurrent Superadmin removals.
- Additional route-gate observation: live `current_user_has_role(text)` checks the caller's approved profile and global role assignment but does not join `auth.users` to check `deleted_at` or `banned_until`. The existing frontend inventory identifies it as a route-level UX gate, not the database security boundary. The proposed 0016 helper `current_user_is_active_approved()` adds those Auth-account checks for the new evaluator, but 0016 does not currently replace the existing `current_user_has_role(text)` function. Review whether to align the route-gate RPC with the active-account helper while preserving its existing signature and grants; do not reapply historical 0002.
- Approval workflow functions in the supplied output (`approve_account`, `review_minor_registration`, login-lockout admin functions) check approved Superadmin role membership but do not assign global roles. The Auth/profile guard functions protect the last-admin invariant on the specified invalidation events.
- No live database object was changed. This was review of owner-supplied definitions only; no SQL was executed.

## Updated review status (2026-11-25, after live trigger/function review)

| Area | Status |
|---|---|
| Existing last-Superadmin trigger coverage for Auth/profile/user_roles/roles events | Definitions reviewed; static review only |
| Canonical role-row synchronization mechanism | Confirmed in supplied function definition |
| Global Superadmin promotion/bootstrap operation | Still unlocated; trusted/manual path needs evidence |
| Cross-trigger lock-order/deadlock behavior | Potential Auth-delete vs direct user_roles mutation inversion; requires two-session reproduction |
| Existing current_user_has_role active Auth-account check | Does not check Auth deleted/banned state; review proposed alignment with 0016 helper |
| PostgreSQL syntax/transaction/concurrency validation | Outstanding |
| Active Supabase changes / SQL execution | None |
| PR / merge / deployment | None |

**Current conclusion:** The live safeguards have meaningful coverage, but runtime safety is not certified. Do not describe the lock-order concern as a confirmed deadlock until reproduced; do not describe the global promotion path as covered until its exact trusted operation is inspected. All proposed scripts remain review-only.


## 2026-11-25 — original first-Superadmin bootstrap recovered from Git history

- Revisited the question of how the first global Superadmin was created. The current branch tree does not contain `supabase/operations/0001_bootstrap_first_superadmin.staging.template.sql`, which led the previous review to mark the trusted path as unlocated.
- GitHub commit history recovered the original deleted/removed template at commit `101d40d5ba389c62b0382ae4168420a8e1b82b96`. Its historical patch contains the full 96-line manual SQL template. The companion design document is still present at `docs/FIRST_SUPERADMIN_BOOTSTRAP.md`.
- The recovered template's intended operation was a trusted, one-time SQL Editor bootstrap, not an application RPC or frontend workflow. It:
  1. accepted a verified existing `auth.users.id` UUID and operator/ticket reference;
  2. required the bootstrap audit table and canonical `superadmin` role;
  3. aborted if the Auth user did not exist, any Superadmin assignment already existed, or the one-time audit event already existed;
  4. transactionally approved/upserted the profile, inserted a global `superadmin` row into `public.user_roles` with `ministry_id = NULL` and `assigned_by = NULL`, and wrote a `first_superadmin_bootstrap` audit event;
  5. committed and then selected the resulting role/profile and audit records for verification.
- This is consistent with the current owner-supplied live assignment shape (global Superadmin, null ministry, null `assigned_by`) and the documented manual first-admin bootstrap process. It is strong evidence of the intended/original method, but it does not prove that this exact historical SQL text was executed against the current active project.
- Important historical limitation: the recovered template was explicitly staging-only and depended on the then-proposed `public.security_bootstrap_audit` table and schema migration. The current branch no longer contains the template, and the current live schema/function inventory supplied in this review did not establish that the old audit table or its dependencies exist. **Do not rerun or adapt the historical template against the active project.**
- The original template did not take an explicit `auth.users` target-row lock before inserting the global role assignment. Therefore it does not, as written, demonstrate the target Auth-user locking required by the current 0018 override concurrency gate. A safe future bootstrap/promotion path must be reviewed against the current schema and use a consistent lock order, then be tested in a disposable PostgreSQL environment.
- No repository source file other than this handoff was changed. No SQL was executed; no live Supabase schema/data changed; no PR was opened; no merge or deployment occurred.
- Review status correction: the historical bootstrap method is now located. The exact execution against the active project remains unverified, and the historical SQL is not approved for reuse.


## 2026-11-25 — current-schema Superadmin promotion review started

- Following recovery of the historical first-Superadmin SQL, prepared a new SELECT-only inspection script: `supabase/review/0022_global_superadmin_promotion_preflight_read_only.review.sql`.
- The script inspects the exact live columns, constraints and indexes for `user_roles`, `profiles`, `roles`, and the planned `user_role_assignment_audit`; checks whether the audit table exists and its RLS/owner state; reports existing global Superadmin assignment rows with account activity/approval status; re-reads the existing Superadmin trigger/function definitions; and searches public functions for references to `user_roles` or `superadmin`.
- The script is SELECT-only. It does not assign roles, approve profiles, create audit records, change grants, or alter any schema. It was read back from GitHub after creation and corrected so it does not directly query the possibly absent audit table and filters the function scan to ordinary functions.
- Initial procedure design constraints:
  - A future trusted promotion operation must lock the target `auth.users` row before inserting the global assignment, then validate the target's Auth status and approved profile while the lock is held.
  - It must use the same target Auth-user lock relied on by 0018 override administration, reject unexpected pre-existing assignments rather than silently replacing them, and record an atomic audit event using a confirmed live audit schema.
  - It must preserve the existing last-active-Superadmin safeguards and be tested for lock order/deadlocks. The historical bootstrap SQL is not reusable as-is because it predates the target Auth-user lock and depends on staging-only audit schema.
  - The one-time break-glass first-admin bootstrap and routine subsequent Superadmin promotion should remain distinct governance paths; application-facing self-promotion must be prohibited.
- Next step: owner runs the new read-only 0022 script in the active Supabase SQL Editor and supplies all result sets. Only after confirming the live table/index/audit definitions can a concrete manual promotion template be drafted. Do not execute any SQL or change live data.
- GitHub commits:
  - 0022 initial: `88eb278467e7e81fc874b99b5affb0f6dbc167c7`
  - 0022 correction: `d62b903de9fe9876682a0445683438fbf25bf9c6`
- No SQL was executed; no active Supabase schema/data changed; no PR, merge, or deployment occurred.


## 2026-11-25 — current-schema global Superadmin promotion template drafted

- Owner supplied all result sets from 0022_global_superadmin_promotion_preflight_read_only.review.sql.
- Confirmed live schema:
  - auth.users: UUID id, nullable banned_until, nullable deleted_at; existing functions also reference email_confirmed_at.
  - profiles: UUID id, is_approved BOOLEAN NOT NULL DEFAULT false, plus approval metadata.
  - roles: canonical superadmin role exists.
  - user_roles: user_id, role_id, scope_type, nullable ministry_id, nullable assigned_by; scope/ministry consistency checks and Auth/role/ministry foreign keys exist.
  - Unique expression index enforces one assignment per (user_id, role_id, scope_type, COALESCE(ministry_id, zero UUID)).
  - One current active, approved global Superadmin assignment was reported.
- public.user_role_assignment_audit is absent from the current live schema, as expected before authorization foundation script 0014 is applied. Script 0014 defines the intended audit columns and accepts operation='assigned' with global scope and null ministry. Script 0017 consumes the same table for ministry assignments.
- Re-fetched and reviewed 0014, 0017, and 0018. The existing override workflow locks actor/target Auth users in sorted UUID order, then profiles, then actor authority rows. The new manual promotion template follows this order.
- Created supabase/review/0023_global_superadmin_promotion.review.sql and fetched it back from GitHub to verify its contents.
  - Manual-only, subsequent-promotion procedure; not a first-admin bootstrap.
  - Requires two different Auth UUIDs (existing Superadmin actor and target) and a meaningful reason.
  - Locks actor/target Auth rows and profiles in deterministic UUID order.
  - Locks the actor's global Superadmin assignment FOR SHARE, then locks canonical roles.id=superadmin FOR SHARE. The latter coordinates with the existing last-Superadmin guard, which takes that canonical row FOR UPDATE.
  - Requires actor and target to be active, email-confirmed, and approved.
  - Rejects any pre-existing Superadmin assignment for the target rather than repairing or replacing it; preserves other legitimate roles.
  - Inserts one global Superadmin assignment (ministry_id=NULL, assigned_by=actor) and one assigned audit row atomically.
  - Includes in-transaction verification queries and deliberately leaves the transaction open for explicit human review followed by COMMIT or ROLLBACK.
  - Checks the audit table exists and has the expected required columns before mutation.
- Static lock-order reasoning only: this design avoids taking a row lock on a target's existing user_roles assignment during promotion. It aligns actor/target Auth/profile locks with 0018 and coordinates with the canonical role-row lock used by the last-Superadmin trigger. It is not proven deadlock-free until independent-session PostgreSQL tests are run.
- Outstanding limitations:
  - 0023 is a review template, not approved for execution. Do not run it against active Supabase.
  - The audit table must first be created by the separately reviewed/approved 0014 foundation; verify its owner, RLS, grants, and append-only trigger after application.
  - No PostgreSQL parser/runtime validation is available in this environment. The template still needs syntax/semantic validation in a disposable PostgreSQL environment.
  - Test promotion concurrently with override set/remove, Superadmin role removal, Auth ban/deletion, profile unapproval/deletion, and other Superadmin demotions; include the previously identified Auth-delete vs direct user_roles mutation deadlock reproduction.
  - The existing first-admin bootstrap remains a distinct break-glass path. The historical staging template must not be reused.
- GitHub commit for 0023: f27cac8e0302ac4076b87b86e56a08d4460f8129.
- No SQL was executed; no active Supabase schema/data changed; no PR was opened; no merge or deployment occurred.
