# ChurchConnect Authorization Schema Reconciliation

Status: Staging inventory captured; approval/bootstrap design drafted on the security branch; no migration applied.

## Verified staging schema

Source: `supabase/diagnostics/0002_schema_details.sql`, run by the project owner against `churchconnect-staging` on 2026-10-27.

Existing public tables and important columns:

- `ministries`: UUID primary key, name, slug, optional description, active flag, creation timestamp. No `leader_id`.
- `modules`: text primary key; 12 seeded module IDs.
- `permissions`: UUID primary key; text module FK, action and scope constrained to the existing allowed values.
- `profiles`: `id` FK to `auth.users`, optional `full_name`, timestamps. No approval/status field.
- `role_permissions`: legacy join table, text role FK and UUID permission FK.
- `roles`: text primary key; name, description, `is_system`. No `hierarchy_level`.
- `user_roles`: UUID primary key, user and role FKs, scope type (`global` or `ministry`), optional ministry FK, optional assigning user, creation timestamp.

Verified seed identifiers:

Roles:
`church_admin`, `church_council`, `member`, `ministry_leader`, `ministry_volunteer`, `superadmin`.

Modules:
`cell_groups`, `children`, `cms`, `congregation`, `evangelism`, `member_portal`, `men`, `praise_worship`, `public_site`, `sunday_service`, `women`, `youth`.

Current staging row counts: ministries 0; modules 12; permissions 0; profiles 0; role_permissions 0; roles 6; user_roles 0.

RLS is enabled on the seven existing tables. The inventory returned no policies and no non-internal triggers on `ministries`, `modules`, `permissions`, `profiles`, `role_permissions`, `roles`, or `user_roles`. Preserve the separately audited `ensure_rls` event trigger; it enables RLS for new public tables and is not a replacement for policies.

## Differences from the current permission specification

1. The specification expects `role_module_permissions` and `user_module_permissions`; neither is part of the current schema.
2. The specification refers to `profiles.is_approved` and an approval timestamp; neither exists.
3. The specification refers to `roles.hierarchy_level`; it does not exist.
4. Ministry ownership examples use `ministries.leader_id`; it does not exist. Existing `user_roles` does support ministry-scoped role assignments.
5. Specification examples use module names such as `portal`, `ministry`, `events`, and `registration`; these are not among the 12 seeded module IDs. Use the verified module IDs unless a deliberate alias/migration is designed.
6. The legacy `permissions` table supports seven action values (`view`, `create`, `update`, `delete`, `manage`, `approve`, `assign`) and three scopes (`global`, `assigned_ministry`, `self`). The new capability model currently describes four booleans (`can_view`, `can_create`, `can_update`, `can_delete`). The handling of `manage`, `approve`, and `assign` must be explicitly defined before any mapping.
7. The existing role/module seed data contains no assignments or permission matrix rows in staging. Do not invent baseline grants or migrate empty legacy mappings as if they represented intended access.

## Security and implementation decisions

- Keep `permissions` and `role_permissions` intact for audit/backward compatibility. Do not treat them as the live authorization source once a new permission engine is introduced.
- Do not seed role grants until the owner-approved role/module/action matrix is established.
- Do not add ministry leader ownership semantics until the owner chooses whether ministry leadership is represented by `user_roles` with `scope_type = 'ministry'`, a new `ministries.leader_id`, or both.
- Approval decision is now set: new profile rows default to `is_approved = false`; approval does not itself grant module permissions. Draft schema: `supabase/migrations/0003_member_approval_and_bootstrap_audit.sql`. A separate manually run staging bootstrap template is `supabase/operations/0001_bootstrap_first_superadmin.staging.template.sql`. Neither has been applied. The bootstrap requires a verified existing Auth user, refuses any pre-existing superadmin assignment or prior bootstrap audit event, and records the action transactionally. See `docs/FIRST_SUPERADMIN_BOOTSTRAP.md`.
- Define the meaning of `active` roles and the source of truth for role hierarchy before implementing protected role assignment and last-superadmin protections.
- Audit all table grants completely before deciding which privileges to revoke. The supplied staging grant output appears truncated, so do not use it as a complete grant inventory.
- Keep production untouched. All migration design and validation must be performed against staging first.

## Next implementation gate

Before writing the first executable migration, complete these decisions:

1. Confirm whether ministry-scoped `user_roles` is the intended source of ministry leadership scope.
2. Approve a role/module/action matrix, including whether `manage`, `approve`, and `assign` are separate capabilities.
3. Review the drafted approval schema and bootstrap safeguards; run them only against staging after verifying the project reference. Confirm the target user identity before the one-time bootstrap.
4. Decide whether role hierarchy is required now and define its values for all six canonical role IDs.
5. Approve a role/module/action matrix, including `manage`, `approve`, and `assign`.
6. Capture the complete staging and production table grants separately; never assume the two environments match.
7. Inspect current frontend data-access paths and align them with the verified module IDs.

No database changes are performed by this document.
