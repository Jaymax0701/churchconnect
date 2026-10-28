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

The staging audit found that `anon`, `authenticated`, and `service_role` have effective `REFERENCES`, `TRIGGER`, and `TRUNCATE` privileges on all seven existing tables. Direct ACL entries from `postgres` also show `MAINTAIN` for those roles. The direct ACL output supplied so far did not show CRUD grants to these roles; do not confuse it with the default-privilege inventory.

The initial default-privilege inventory reported:
- `postgres` defaults in `public`: `MAINTAIN`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` for `anon`, `authenticated`, and `service_role`.
- `supabase_admin` defaults in `public`: CRUD plus those additional privileges for the same API roles.

**Latest staging postconditions (2026-10-28):** the effective-privilege verification query returned zero rows for `MAINTAIN`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` across the seven existing tables for `anon`, `authenticated`, and `service_role`. The latest default-ACL output no longer showed `postgres`-owned defaults for those API roles; `supabase_admin`-owned defaults remained. These results confirm the observed database state, but do not by themselves prove which exact SQL file was executed.

The audited session is `postgres`, which is not a member of `supabase_admin`. The migration draft `supabase/migrations/0002_restrict_future_table_defaults.sql` has therefore been narrowed to revoke defaults only for tables created by `postgres`. It intentionally leaves `supabase_admin` defaults unchanged. Resolve those defaults through an authorized Supabase/platform administrative path; do not change privileged role memberships to bypass the access boundary.

Two draft migrations exist on the security branch:
- `supabase/migrations/0001_revoke_unsafe_table_privileges.sql` — revokes `MAINTAIN`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` on the seven existing tables from the three API roles. It does not grant CRUD.
- `supabase/migrations/0002_restrict_future_table_defaults.sql` — revokes all default table privileges for those roles on future public tables created by `postgres`.

The effective-privilege postcondition for migration `0001` is now satisfied in staging (zero rows returned). The latest default-ACL inventory also indicates that the `postgres`-owned defaults targeted by migration `0002` are no longer present for these API roles. The user has not separately confirmed the exact execution history, so retain the scripts as reviewed artifacts and do not infer more than the observed postconditions. New migrations should explicitly grant only required privileges, together with reviewed RLS policies. Do not apply either draft to production.

The remaining `supabase_admin` default ACL is a known unresolved issue: until an authorized administrative path corrects it, tables created under that role may inherit overly broad privileges. Avoid creating application tables under that owner until the issue is resolved, and inspect grants immediately for any table created by platform tooling.

No CRUD grants should be added until the per-table access model and corresponding RLS policies are designed together.

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
