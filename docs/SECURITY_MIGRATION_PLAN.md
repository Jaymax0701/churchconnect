# ChurchConnect Security Migration Plan

Status: Draft for review — staging privilege postconditions verified; approval schema and bootstrap drafts added but NOT applied; authorization policies are not yet implemented.

## Scope and safety boundary

This plan reconciles `docs/PERMISSIONS.md` with the currently audited Supabase schema. It is not an executable migration and must not be applied to production. The implementation migration is blocked until the complete schema, actual role identifiers, intended module mapping, and application data-access paths are confirmed.

Known current schema from the database audit:
- `ministries`
- `modules`
- `permissions` (legacy)
- `profiles`
- `role_permissions` (legacy)
- `roles`
- `user_roles`

The audit found RLS enabled on all seven tables, no policies, and an enabled `ensure_rls` event trigger that enables RLS on newly created public tables. Preserve that event trigger unless separately reviewed.

### Staging privilege audit

Evidence received from the owner on 2026-11-03 from read-only diagnostics `0004_privilege_sources.sql` and `0005_default_privilege_authority.sql` against the staging project (`aibstkdijaruvtvqaxke`). These findings supersede earlier, inaccurate summaries in this document.

**Existing application tables (seven-table scope):**
- The direct relation ACL query showed `postgres` as the only grantee for the seven audited tables (`ministries`, `modules`, `permissions`, `profiles`, `role_permissions`, `roles`, `user_roles`). It did not show direct ACL entries granted to `anon`, `authenticated`, or `service_role`.
- The effective-privilege query for `REFERENCES`, `TRIGGER`, and `TRUNCATE` returned no rows for `anon`, `authenticated`, or `service_role` on those seven tables.
- This is not a complete CRUD audit. Effective `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges across all public tables remain to be checked with `supabase/diagnostics/0003_privilege_inventory.sql`. Do not infer that API roles have no CRUD access from the seven-table ACL output alone.

**Default table privileges in `public`:**
- The latest default-ACL output showed grants owned by `supabase_admin` to `anon`, `authenticated`, and `service_role` for `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN`.
- The latest output did not show `postgres`-owned default table ACL entries for those API roles. Therefore, the current evidence does not support claiming that the `postgres`-owned defaults targeted by draft `0002` are still present.
- These are defaults for future tables created under the respective default-privilege owner. They do not establish that every existing table currently has those grants.

**Authority boundary:**
- The SQL Editor session reported `current_user = postgres` and `session_user = postgres`.
- `postgres` was a member of `postgres`, but was not a member of `supabase_admin` and did not inherit its privileges.
- The `supabase_admin` role reported `rolsuper = true`; this does not confer superuser authority on the current `postgres` session.
- Do not attempt to change role memberships or assume the current session can alter `supabase_admin` defaults. Resolve that finding through an authorized Supabase/platform administrative path.

**Disposition of existing drafts:**
- `supabase/drafts/0001_revoke_unsafe_table_privileges.staging.sql` is not approved to run based on the current evidence. Its target non-CRUD privileges were not found as effective privileges for the three API roles on the seven existing tables. Revisit only if a broader inventory identifies a concrete grant requiring removal.
- `supabase/drafts/0002_restrict_future_table_defaults.staging.sql` is not approved to run based on the current evidence. Its target `postgres`-owned defaults were not present in the latest default-ACL output; it would not resolve the remaining `supabase_admin`-owned defaults.
- Do not attempt to revoke or alter `supabase_admin` defaults from the current `postgres` session.
- No privilege-changing SQL was authorized or executed as part of this audit exchange.

**Remaining checks and constraints:**
1. Run `supabase/diagnostics/0003_privilege_inventory.sql` in staging and review all three result sets. This is the outstanding check for effective CRUD access across all public tables and public-schema `USAGE`/`CREATE`.
2. Identify whether application tables are ever created under `supabase_admin` ownership and which trusted platform workflows use that owner. Do not create new application tables under that owner until the default ACL issue is resolved through an authorized route.
3. Keep service-role consumers and external administrative workflows inventoried before any broad revocation. The trusted workflow inventory remains owner-confirmation work; repository inspection alone does not prove external workflows are absent.
4. No CRUD grants should be added until the per-table access model and corresponding RLS policies are designed together.
5. Preserve the existing RLS event trigger and bootstrap/audit safeguards unless a separate review explicitly justifies a change.

## Required schema reconciliation

Before authoring executable SQL, capture the exact column types, primary keys, unique constraints, foreign keys, defaults, existing data, and grants for all seven tables. Confirm whether role IDs are slugs, UUIDs, or another key type. The permission specification uses examples such as `SUPERADMIN`, but the restored seed data includes lower-case role names; never assume those values are interchangeable.

Proposed additions from the specification:
- `roles.hierarchy_level`
- `profiles.is_approved`, `approved_at`, and `approved_by` (now designed in draft migration `0003_member_approval_and_bootstrap_audit.sql`)
- `ministries.leader_id`
- `role_module_permissions`
- `user_module_permissions`

The approval/bootstrap design is documented in `docs/FIRST_SUPERADMIN_BOOTSTRAP.md`. New profiles default to unapproved, and the draft adds an `auth.users` trigger to create each new profile with approval set to false. The schema migration does not assign a superadmin. A separate manual staging-only bootstrap template requires a verified existing Auth user, fails if any superadmin assignment or prior bootstrap event exists, and writes the approval, global role assignment, and restricted audit event in one transaction. Neither file has been executed.

Do not create foreign keys or seed mappings until their target types and canonical role/module identifiers are verified. Keep legacy `permissions` and `role_permissions` intact. Any historical permission mapping must be reviewed and migrated through a separate auditable mapping step; do not guess mappings.

## Authorization invariants

1. Unauthenticated callers have no protected access; public data must be explicitly identified and separately governed.
2. Unapproved users cannot access protected congregation features.
3. Explicit per-user `FALSE` overrides role-derived grants.
4. Explicit per-user `TRUE` is a capability grant only; approval, active module, record scope, and integrity constraints still apply.
5. Role grants combine using logical OR across active assigned roles.
6. Missing grants deny by default.
7. Ministry leaders are limited to ministries they lead; module permissions do not grant unrestricted row access.
8. Role assignment and approval changes must not be self-service privilege escalation.
9. Superadmin protection must cover all supported mutation paths and serialize concurrent promotions/demotions.
10. The database is authoritative; frontend route visibility is not a security boundary.

## Function hardening requirements

For any SECURITY DEFINER function:
- Set a safe, explicit search path and schema-qualify all referenced relations.
- Use a restricted owner and revoke default PUBLIC execution.
- Grant EXECUTE only to the roles that require it.
- Derive caller identity from `auth.uid()`; do not accept a caller-supplied identity for ordinary permission checks.
- Avoid dynamic SQL.
- Review function behavior under RLS and ensure it cannot become an arbitrary data-access or privilege-escalation RPC.

The exact search path and ownership must be validated against the deployed Supabase environment and function dependencies before implementation.

## Important design corrections before implementation

The proposed trigger example in `docs/PERMISSIONS.md` is a blueprint, not production-ready SQL. It needs a separate review for:
- The exact trigger operation and row shape for INSERT, UPDATE, and DELETE.
- Correctly identifying the affected user when a role assignment is updated.
- Counting remaining *active and approved* superadmins after accounting for the pending mutation.
- Ensuring promotion and demotion paths acquire the same lock anchor before relevant reads/mutations.
- Ensuring profile approval/deactivation and cascading auth-user deletion are covered.
- Avoiding recursive trigger/function calls and avoiding unsafe reliance on a caller's RLS-visible rows.
- Ensuring the last-admin invariant does not accidentally block authorized administrative setup or initial bootstrap.
- Concurrency tests with two independent sessions, including rollback behavior.

Do not copy the proposed trigger verbatim into a migration.

## Migration and validation sequence

1. Produce a schema inventory from the current staging database and compare it with the production schema. No writes.
2. Confirm canonical role IDs/names, module identifiers, and whether any production records need backfill.
3. Review and test the table-privilege and default-privilege drafts in staging only, with explicit preconditions and postcondition checks.
4. Review `0003_member_approval_and_bootstrap_audit.sql`; apply it to staging only after confirming the exact project reference and taking the agreed backup/restore precautions. Verify the `false` default and audit-table restrictions.
5. If and only if the staging schema migration passes verification, use the separate manual bootstrap template with an independently verified existing Auth user. Do not automate or include bootstrap assignment in deployment migrations.
6. Resolve the `supabase_admin` default ACL through an authorized platform path before creating application tables under that owner.
7. Write the remaining authorization migration with explicit preconditions and fail-fast checks. Preserve legacy tables and existing rows.
8. Add SQL regression tests for:
   - anonymous protected reads/writes denied;
   - approved member self-profile access only;
   - unapproved member blocked from protected features;
   - explicit denial overrides role grant;
   - multiple-role grants combine additively;
   - missing grant denied;
   - inactive module denied to non-superadmin;
   - ministry A leader cannot access ministry B records;
   - non-admin cannot approve self or assign protected roles;
   - church admin cannot modify superadmin assignments;
   - last active approved superadmin cannot be removed/deactivated;
   - concurrent demotions cannot leave zero active superadmins;
   - legacy permission tables do not affect live permission resolution.
9. Apply remaining changes only to staging after reviewing the SQL. Test using real authenticated test users and the publishable key, not only the database owner or service role.
10. Inspect resulting policies, grants, function definitions, and trigger definitions; run regression tests and app build/workflow checks.
11. Production rollout remains a separate, explicitly approved action with a rollback/restore plan.

## Authentication dependency

The current `src/modules/auth/pages/LoginPage.tsx` is a demonstration form; it does not call `supabase.auth.signInWithPassword`. The security migration can establish database-side controls, but end-to-end user authorization cannot be considered validated until live authentication and session handling are implemented and tested. The app currently checks `supabase.auth.getSession()` for connectivity/session status only.

## Release gate

Do not apply to production until:
- schema reconciliation is complete;
- migration and tests pass in staging;
- real authenticated-user tests demonstrate both allowed and denied cases;
- last-superadmin concurrency tests pass;
- authentication/session implementation is in place for end-to-end tests;
- a separate production rollout is explicitly approved.


## Deployment safety correction (2026-10-28)

The staging-only SQL files `0001_revoke_unsafe_table_privileges`, `0002_restrict_future_table_defaults`, and `0003_member_approval_and_bootstrap_audit` have been moved from `supabase/migrations/` to `supabase/drafts/` with `.staging.sql` names. This prevents them from being picked up as numbered Supabase migrations if this PR is merged. The owner has run staging SQL manually; the approval/bootstrap objects were verified in staging after the migration run encountered a duplicate-function error. Do not rerun draft 0003 as a whole. No production SQL has been run by the assistant. Any future production rollout requires a separate approved migration plan.
