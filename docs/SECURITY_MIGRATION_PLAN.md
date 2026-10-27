# ChurchConnect Security Migration Plan

Status: Draft for review — no database changes applied.

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

The audit found RLS enabled on all seven tables, no policies, broad table-level grants for `anon` and `authenticated`, and an enabled `ensure_rls` event trigger that enables RLS on newly created public tables. Preserve that event trigger unless separately reviewed.

## Required schema reconciliation

Before authoring executable SQL, capture the exact column types, primary keys, unique constraints, foreign keys, defaults, existing data, and grants for all seven tables. Confirm whether role IDs are slugs, UUIDs, or another key type. The permission specification uses examples such as `SUPERADMIN`, but the restored seed data includes lower-case role names; never assume those values are interchangeable.

Proposed additions from the specification:
- `roles.hierarchy_level`
- `profiles.is_approved` and approval timestamp (confirm canonical column name)
- `ministries.leader_id`
- `role_module_permissions`
- `user_module_permissions`

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
3. Write one numbered, transactional migration with explicit preconditions and fail-fast checks. Preserve legacy tables and existing rows.
4. Add SQL regression tests for:
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
5. Apply only to staging after reviewing the SQL. Test using real authenticated test users and the publishable key, not only the database owner or service role.
6. Inspect resulting policies, grants, function definitions, and trigger definitions; run regression tests and app build/workflow checks.
7. Production rollout remains a separate, explicitly approved action with a rollback/restore plan.

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
