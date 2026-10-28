# ChurchConnect Authorization Implementation Gate

Status: Draft artifacts added on 2026-10-28. No authorization-foundation draft has been applied or database-tested.

## Verified staging state

Project: `churchconnect-staging`, ref `aibstkdijaruvtvqaxke`.

The owner supplied SQL Editor results verifying:
- `profiles.is_approved` exists, is NOT NULL, and defaults to false.
- `approved_at` and `approved_by` exist.
- `public.security_bootstrap_audit` has RLS enabled.
- `public.handle_new_auth_user_profile()` is owned by `postgres`, SECURITY DEFINER, and uses an empty search path.
- `on_auth_user_created_profile` is enabled on `auth.users`.
- The trigger function is executable by `postgres`, not by `anon`, `authenticated`, or `service_role`.
- Application roles have no direct SELECT/INSERT/UPDATE/DELETE privileges on the bootstrap audit table.
- The first-superadmin bootstrap was recorded for the verified staging account with `is_approved = true`, a global `superadmin` assignment, and a non-placeholder operator reference.

These are user-supplied verification results. They do not mean this repository migration draft was automatically applied by GitHub or that production was changed.

## Draft artifacts

- `supabase/drafts/0004_authorization_foundation.staging.sql`: review-only, intentionally outside `supabase/migrations` so CLI migration deployment cannot pick it up automatically.
- `supabase/tests/0004_authorization_foundation_catalog.test.sql`: catalog assertions to run only after the draft has been deliberately reviewed and applied to staging.

The draft:
- Fails fast unless the expected six role IDs, twelve module IDs, approved bootstrap profile, and global superadmin assignment are present.
- Adds the agreed nullable `ministries.leader_id` primary-leader reference.
- Adds `role_module_permissions` and `user_module_permissions`; it inserts no permission rows.
- Enables RLS on the ten relevant tables and revokes all direct table privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- Adds only own-profile SELECT and own `full_name` UPDATE for `authenticated`; the approval fields are not client-updatable.
- Adds invoker-context triggers intended to block API-role changes to approval metadata and direct role assignment mutations.
- Does not add public-site access, ministry-scoped CRUD policies, role grants, a role hierarchy, or the full last-superadmin guard.

The draft is deliberately restrictive and may temporarily break any application or server workflow relying on direct table access. Review all server/service-role use before application. A trusted database-owned administrative workflow must be designed before approval/role changes can be made through the app.

## Why the role/module matrix is still a blocker

`docs/ROLE_MODULE_PERMISSION_MATRIX.md` still marks all CRUD permissions as PENDING. No role/module grants may be seeded until the owner approves the matrix. The draft therefore does not assume that any role, including `superadmin`, has implicit CRUD access.

Still unresolved before production-ready authorization:
1. Approved role/module/action matrix for all six roles and twelve modules.
2. Special capabilities `manage`, `approve`, and `assign`.
3. Public-site tables/columns that may be read by `anon`.
4. Role hierarchy and rules for appointing/removing additional and primary ministry leaders.
5. Trusted transactional workflows for approval and role assignments, including a concurrency-safe last-active-superadmin guard.
6. Full app access/grant audit, including `supabase_admin` default ACLs and any service-role server workflows.
7. Real Supabase Auth integration: the current login page is a demonstration form, not live sign-in.

## Safe validation sequence

1. Inspect the draft in a clean working tree and review every statement.
2. Confirm staging project ref `aibstkdijaruvtvqaxke` in the SQL Editor.
3. Take/verify a restorable staging backup and confirm the restore procedure.
4. Check that the draft's strict revokes will not break required server-side workflows.
5. Apply the draft manually to staging only, if approved.
6. Run `supabase/tests/0004_authorization_foundation_catalog.test.sql` and inspect the policy/grant/function/trigger catalogs.
7. Add behavioral tests with real test Auth users for approved/unapproved profiles, self-profile access, denied approval changes, denied direct role assignment, cross-ministry isolation, missing permission deny, explicit user deny, and concurrent last-superadmin removal attempts.
8. Do not apply to production. Production requires a separate review, explicit authorization, tested rollback/restore, and its own current inventory.

No SQL in the draft or test file has been executed by the assistant.
