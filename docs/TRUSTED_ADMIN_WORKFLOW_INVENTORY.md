# ChurchConnect Trusted Administrative Workflow Inventory

Status: Review checklist; external workflow inventory is not yet owner-verified.
Inspection baseline: `main` at authorization decision-register merge `01e4106861b483ba2416bba939739600b10d56e8`.
Scope: identify every trusted path that can approve accounts, assign/revoke roles, change permission grants, mutate role definitions, or remove an active superadmin before privilege revocation or administrative RPC implementation.

## 1. Evidence boundary

The tracked repository inspection found a browser Supabase client using only the publishable key and did not reveal a tracked server/API route or Supabase Edge Function directory. This is not evidence that no external consumers exist. The owner must verify Supabase Edge Functions, deployed functions not present in Git, scheduled jobs, CI/CD secrets, hosting-provider functions, administrative scripts, integrations, and any direct database clients.

Never place a Supabase service-role secret in browser code or any `VITE_*` variable. Do not paste secret values into this checklist or GitHub issues. Record only the workflow name, location, purpose, credential class, tables/actions touched, owner, and verification date.

## 2. Inventory checklist — owner confirmation required

For each item, mark **Present**, **Absent (verified)**, or **Unknown**. Unknown is a blocker for broad privilege revocation.

| Workflow / consumer | Status | Evidence to inspect | Required details |
|---|---|---|---|
| Supabase Edge Functions | UNKNOWN | Dashboard function list and deployed source | Function name, JWT verification, secret use, tables/RPCs touched |
| External API/server backend | UNKNOWN | Hosting/deployment settings and repository/org inventory | Routes, identity validation, direct DB access, tables/actions |
| Scheduled jobs / cron / database webhooks | UNKNOWN | Supabase jobs, provider schedulers, webhook config | Trigger, execution identity, write scope, retry behavior |
| CI/CD or operational scripts | UNKNOWN | GitHub Actions/workflows and deployment configuration (never expose secrets) | Job, credential class, database operations, environment |
| Admin UI / direct client writes | PARTIALLY VERIFIED | `src/modules/admin/pages/AdminDashboardPage.tsx` | Current inspected page uses demo state; confirm no other deployed client |
| Manual SQL administration | PRESENT | Supabase project access and operator procedure | Authorized operators, change review, audit/evidence retention |
| Account approval workflow | NOT IMPLEMENTED IN INSPECTED UI | Auth/profile trigger, app routes, deployed functions | Who can approve, self-approval prevention, audit trail |
| Role assignment / revocation | NOT IMPLEMENTED IN INSPECTED UI | `user_roles`, deployed functions, admin scripts | Allowed assigner/target/scope, anti-escalation, audit |
| Permission matrix management | DEMO ONLY IN INSPECTED UI | Admin UI and deployed endpoints | Who may alter grants, validation, audit, rollback |
| Last-superadmin mutation paths | REQUIRED, NOT VERIFIED | FK cascades, triggers, roles/user_roles/profiles/auth.users | All INSERT/UPDATE/DELETE/approval/deletion paths and shared lock |

Do not mark a workflow absent solely because it is not in the tracked source tree. Attach non-secret evidence or a dated owner attestation before closing an item.

## 3. Required design for trusted administrative operations

Once the inventory is complete, implement narrow database-backed operations rather than granting broad table writes to the browser:

1. Authenticate the caller from the verified Supabase request context; derive identity from `auth.uid()`, never from a caller-supplied actor ID.
2. Require an approved, active administrator with an explicitly approved capability for the exact operation. Do not infer authority from role names or a pending matrix.
3. Validate the target user, canonical role, scope shape, ministry existence/activity, and permitted delegation rules.
4. Prohibit self-approval and self-elevation; enforce the approved delegation boundary.
5. For any mutation that could remove or invalidate an active global superadmin, acquire the same synchronization lock before relevant reads/writes, apply the mutation, and re-check that at least one active, approved global superadmin remains within the same transaction. Cover cascades and role/profile/account mutations, not just direct `user_roles` deletes.
6. Write an audit record atomically with the successful operation. Include actor, target, operation, old/new state or a safe diff, reason, timestamp, and request/operator reference. Do not log secrets or session tokens.
7. Fail closed if authorization, scope, audit write, or invariant validation fails. Roll back the entire transaction.
8. Restrict function EXECUTE to the intended caller class; harden any SECURITY DEFINER function with a reviewed owner, fixed search path, schema-qualified objects, no dynamic SQL, and minimal grants.
9. Add negative tests and two-independent-session concurrency tests in staging using disposable test accounts. Never use the real bootstrap superadmin as a destructive test target.

This is a design checklist, not a claim that the operations or guards exist.

## 4. Exit criteria before privilege revocation

- [ ] Every workflow above is Present or Absent (verified), with evidence and owner/date.
- [ ] Service-role and database-owner usage is mapped to exact tables/actions; no secrets committed.
- [ ] Required workflows have an approved least-privilege design and rollback procedure.
- [ ] The last-active-superadmin invariant covers role assignment mutations, profile approval/status/deletion, role mutation/deletion, `auth.users` deletion/cascades, and concurrency.
- [ ] All role/module/action grants and special capabilities are approved separately; PENDING remains DENY.
- [ ] Staging backup is restorable and the impact of the draft's revokes is understood.
- [ ] Real Supabase Auth JWT tests and catalog tests pass in staging.
- [ ] Production remains excluded until a separate explicit authorization and production-specific review.

## 5. Explicit non-claims

This checklist does not confirm that external workflows are absent, does not implement any trusted workflow, does not approve permission grants, and does not authorize applying any SQL. The authorization-foundation draft remains unapplied unless the owner explicitly approves staging execution after review. Production changes are out of scope.
