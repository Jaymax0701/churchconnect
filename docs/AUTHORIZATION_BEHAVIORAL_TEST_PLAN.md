# ChurchConnect Authorization Behavioral Test Plan

Status: Test specification only. Not executable against the current authorization-foundation draft. Run in an isolated staging environment after the relevant policies, permission resolver, and trusted administrative workflows have been implemented and reviewed.

## Safety and test fixtures

- Target only staging project ref `aibstkdijaruvtvqaxke`.
- Use dedicated, disposable Auth accounts and synthetic ministry/member records. Never use the real bootstrap superadmin as a test subject for destructive cases.
- Obtain authenticated sessions through Supabase Auth. SQL Editor `SET ROLE` alone is not proof that PostgREST/JWT authorization behaves correctly.
- Record expected status/result, actual result, SQL/API error code, actor ID, target ID, module/action, and ministry scope for every case.
- Keep this plan non-destructive until fixtures, reset procedure, and rollback are reviewed. Do not run against production.

## Required cases

| ID | Scenario | Expected result | Readiness |
| --- | --- | --- | --- |
| AUTH-01 | Anonymous request to protected member data | Denied; no protected rows returned | Blocked: policies pending |
| AUTH-02 | Authenticated but unapproved user requests protected data | Denied; self-profile bootstrap access only as explicitly allowed | Blocked: policies pending |
| AUTH-03 | Approved user reads own profile | Allowed | Foundation policy exists; verify with real JWT |
| AUTH-04 | User reads another member's profile | Denied; zero rows or permission error | Foundation policy exists; verify with real JWT |
| AUTH-05 | User updates own `full_name` | Allowed | Foundation policy exists; verify with real JWT |
| AUTH-06 | User updates `is_approved`, `approved_at`, `approved_by`, profile ID, or protected timestamp | Denied | Foundation grants/guard exist; verify with real JWT |
| AUTH-07 | API role directly inserts, updates, or deletes `user_roles` | Denied | Foundation grants/guard exist; verify with real JWT |
| AUTH-08 | Missing role/module permission row | Denied by default | Blocked: permission resolver pending |
| AUTH-09 | Role grants an action and no user override exists | Allowed only if approval, module activity, and row scope all pass | Blocked: resolver/policies pending |
| AUTH-10 | Non-superadmin per-user explicit `FALSE` conflicts with an ordinary role grant | Denied | Blocked: resolver pending |
| AUTH-10a | Authenticated, approved superadmin has explicit per-user `FALSE` | Ordinary override is bypassed; allowed only if all agreed safeguards pass | Blocked: resolver pending |
| AUTH-10b | Authenticated, approved superadmin has explicit per-user `TRUE` | Ordinary override is bypassed; allowed only if all agreed safeguards pass | Blocked: resolver pending |
| AUTH-11 | Per-user explicit `TRUE` but user is unapproved or row is out of scope | Denied | Blocked: resolver/policies pending |
| AUTH-12 | Ministry leader accesses a row belonging to a different ministry | Denied | Blocked: ministry policies pending |
| AUTH-13 | Additional leader has a ministry-scoped role for Ministry B but is primary leader of Ministry A | May access only explicitly authorized rows in B; no leadership authority leaks from A | Blocked: leadership workflow/policies pending |
| AUTH-14 | Inactive module or inactive ministry | Denied for protected operations under that module/ministry | Blocked: resolver/policies pending |
| AUTH-15 | Non-admin attempts member approval or role assignment through the trusted workflow | Denied and no rows changed | Blocked: trusted RPC/workflow pending |
| AUTH-16 | Admin attempts to assign a role above their approved authority | Denied and audited | Blocked: hierarchy/special-capability decisions pending |
| AUTH-17 | Attempt to demote/delete the only active approved superadmin | Denied; active superadmin remains | Blocked: last-superadmin guard pending |
| AUTH-18 | Two concurrent transactions attempt to remove the last two active superadmins | At most one removal commits; at least one active approved superadmin remains | Blocked: lock design and two-session test pending |
| AUTH-19 | Public-site anonymous read of specifically approved public content | Allowed only for explicitly allowlisted tables/columns; private fields remain inaccessible | Blocked: public data allowlist pending |
| AUTH-20 | Service-role/server workflow performs a documented administrative task | Works only through an explicitly reviewed server-only path; no assumption that service_role bypasses table grants | Blocked: service workflow inventory pending |

## Execution protocol

1. Create fixtures with at least two approved users, one unapproved user, two ministries, and assignments that deliberately cross ministry boundaries.
2. Execute each read/write case using the actual user session/JWT for the actor, not a SQL Editor owner connection.
3. For each denial, verify both the returned error/result and that no protected row changed.
4. For non-superadmin override tests, include role grants that would otherwise allow the action, then prove explicit `FALSE` denies and explicit `TRUE` still respects approval and scope. Separately prove an authenticated, approved superadmin bypasses both override values while all agreed safeguards remain enforced.
5. Run the last-superadmin concurrency case in two independent SQL sessions using a dedicated disposable fixture and the reviewed locking mechanism. Verify the final invariant after both transactions settle.
6. Re-run catalog tests after behavioral tests and inspect effective privileges, policies, function owners, function security modes, search paths, and trigger enablement.
7. Reset fixtures using a reviewed cleanup script; retain sanitized test evidence.
8. Do not call the implementation production-ready until all required cases pass and the owner has approved the permission matrix and rollout plan.

## Current blockers

- Owner-approved role/module/action matrix for six roles and twelve modules.
- Separate decisions for `manage`, `approve`, and `assign`.
- Public-site table/column allowlist.
- Hierarchy and primary/additional ministry leader appointment rules.
- Reviewed trusted approval/role-assignment workflow and concurrency-safe last-superadmin guard.
- Service-role/server workflow inventory and effective-grant audit.
- Live Supabase Auth integration in the application.
