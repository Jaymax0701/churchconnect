# ChurchConnect Authorization Review Findings

Status: Review findings only. No database changes. No permission grants are approved by this document.

## Scope reviewed

Reviewed on 2026-10-28 against the authorization foundation draft, catalog test, role/module matrix, behavioral test plan, and `docs/PERMISSIONS.md`.

## Findings that must be resolved before implementing live authorization

### AUTH-REV-01 — Permission precedence conflicts with superadmin bypass

`docs/PERMISSIONS.md` places an active superadmin allow before the per-user explicit-deny check, while its rule 3 says explicit user denial strictly denies access regardless of assigned roles. The matrix template correctly keeps even superadmin CRUD grants pending. These rules cannot all be true simultaneously.

**Required decision:** explicitly define whether a per-user deny can constrain superadmin. Document any non-overridable emergency/system operations as separate audited capabilities. Do not implement the resolver until this precedence is unambiguous.

### AUTH-REV-02 — Documentation module aliases do not match the restored schema

The permissions architecture refers to `portal`, `ministry`, `events`, and `registration`; the verified staging module inventory uses `member_portal`, ministry-specific modules, `sunday_service`, and other canonical IDs. No `events` or `registration` module is in the 12-module inventory.

**Required action:** use exact canonical module IDs in implementation and label any domain/table examples separately from module identifiers. Do not create alias modules or map legacy identifiers implicitly.

### AUTH-REV-03 — Role hierarchy is specified but not represented in the schema

`docs/PERMISSIONS.md` requires `roles.hierarchy_level`, but the staging schema inventory shows no hierarchy column. Role names or text sorting are not a safe substitute for an approved hierarchy.

**Required decision:** either approve and design a schema-backed hierarchy with exact levels and comparison semantics, or defer hierarchy-based delegation and prohibit role delegation until a separately reviewed rule exists.

### AUTH-REV-04 — Public-site access has no allowlist yet

The `public_site` module alone does not identify which database tables or columns are safe for anonymous reads. The foundation correctly fails closed, but a public website may stop working until the allowlist and narrow policies are implemented.

**Required action:** inventory actual public-site queries and columns, classify fields as public/private, then add narrow read-only policies and tests. Never expose profile, roster, approval, or administrative data merely to make the public UI work.

### AUTH-REV-05 — Trusted administrative workflows are not implemented

The foundation blocks API-role mutations of `user_roles` and approval metadata, but no reviewed transactional RPC/workflow is included. The draft also revokes direct table privileges from `service_role`, which may break server-side workflows that relied on direct access.

**Required action:** inventory server-side use; design narrowly scoped trusted approval/role-assignment operations; verify function ownership, fixed search path, execute grants, caller authorization, audit records, and denial behavior. Do not restore broad direct grants as a workaround.

### AUTH-REV-06 — Last-active-superadmin invariant is not yet enforced

The foundation draft has no complete guard covering role demotion/deletion, profile approval changes/deletion, Auth-user deletion/cascade, and concurrent transactions. A count-only check without a shared lock is insufficient.

**Required action:** implement a reviewed invariant using a common transaction-level synchronization anchor for every mutation path that can reduce the active approved superadmin count. Test with two independent sessions and disposable accounts. Never use the real bootstrap account as a destructive test fixture.

### AUTH-REV-07 — Login is still a demonstration flow

The current login page uses client-side demonstration behavior rather than a real Supabase Auth session. Catalog tests and SQL Editor role simulation cannot prove end-to-end API authorization.

**Required action:** implement real sign-in/session handling and route protection as a usability layer, while retaining PostgreSQL as the authorization authority. Execute behavioral tests using actual Auth sessions/JWTs.

## Foundation draft review note

The draft is intentionally fail-closed and is not a complete application authorization rollout. It grants authenticated users only own-profile SELECT and own `full_name` column UPDATE; it does not yet provide public content access, module CRUD policies, permission resolution, trusted admin workflows, or a full last-superadmin guard.

Before any staging application, review every REVOKE against actual application and server workflows and confirm a restorable staging backup. Production requires a separate inventory, rollout plan, tested rollback, and explicit authorization.

## Acceptance gate

Do not promote the draft or mark authorization production-ready until:

- The permission precedence and superadmin exception model is approved.
- The exact role/module/action matrix and special `manage`, `approve`, and `assign` capabilities are approved.
- Canonical module identifiers are consistent across docs, code, and tests.
- Public data and ministry scope are explicitly defined.
- Trusted workflows and concurrency-safe last-superadmin protection are implemented and tested.
- Catalog and real-JWT behavioral tests pass in staging.
- Server/service-role access and default privileges have been audited.
