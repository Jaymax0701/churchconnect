# ChurchConnect: First Superadmin Bootstrap

Status: Design only. No database changes performed. The procedure below is for the confirmed staging project only; production requires a separate approval.

## Approval rule

New profile rows must default to `is_approved = false`. A user must not be able to approve themselves, assign themselves a role, or bypass approval through a role assignment. Missing profile/approval state means protected access is denied. Approval is necessary but does not itself grant module permissions.

## Trusted one-time bootstrap

1. Confirm the Supabase dashboard/project reference is `aibstkdijaruvtvqaxke` (`churchconnect-staging`). Do not rely on a project display name alone.
2. Create the intended first administrator through the trusted Supabase Auth/admin process. Verify the identity independently before using the account UUID.
3. Review and apply the separate schema migration to staging only. Verify `profiles.is_approved` is `NOT NULL DEFAULT false`, the approval metadata columns exist, and the restricted bootstrap audit table has RLS enabled and no grants to `PUBLIC`, `anon`, `authenticated`, or `service_role`.
4. A trusted database operator runs the separate manual bootstrap template with the verified existing `auth.users` UUID and a meaningful operator/ticket reference. Do not expose it as an RPC or frontend action.
5. The operation must run transactionally and abort if the target auth user does not exist, the canonical `superadmin` role is missing, any superadmin assignment already exists, or the one-time audit event already exists. It approves the target, assigns the global `superadmin` role, and records one bootstrap event in the same transaction.
6. Verify the role assignment, approved profile state, and audit row. Keep the execution record in the project’s controlled change log.

The audit `operator_reference` is an operator-entered annotation, not cryptographic identity proof. The database owner executing a SQL-editor script is trusted infrastructure authority; do not claim that `auth.uid()` identifies that operator in this context.

## Safeguards and limitations

- The bootstrap script is not part of automated migrations and must not run automatically on deployment.
- The audit table uses a unique event key to prevent a second first-bootstrap record. The script also checks existing superadmin assignments and will not silently replace one.
- `assigned_by` is `NULL` for this initial bootstrap because the SQL-editor operator is not necessarily an authenticated ChurchConnect user. The separate audit row records the operator reference and reason.
- If any superadmin assignment exists but is unapproved or invalid, stop and reconcile manually; do not delete or overwrite assignments automatically.
- Do not apply the migration or bootstrap to production. Production approval/backfill and rollout require a separate plan and explicit authorization.
- This schema alone does not implement the full approval workflow or all RLS policies. A later migration must add hardened approval/role-management paths, profile and role-assignment RLS, module permission tables, and regression tests before client CRUD grants are introduced.
- The current login page is a demo form, so end-to-end authorization cannot be considered validated until live Supabase Auth sessions are implemented and tested.

## Verification checklist

- [ ] Confirm staging project reference before every database operation.
- [ ] Review migration SQL and backup/restore posture.
- [ ] Verify new profiles default to unapproved.
- [ ] Verify direct app-role access to the bootstrap audit table is absent.
- [ ] Verify bootstrap preconditions fail safely on a second run.
- [ ] Verify the intended user is approved and has one global superadmin assignment.
- [ ] Verify the audit event is present and is not exposed to client roles.
- [ ] Test that an ordinary authenticated user cannot change `is_approved` or assign roles.
- [ ] Do not treat this bootstrap as a substitute for the remaining RLS/permission-engine implementation.
