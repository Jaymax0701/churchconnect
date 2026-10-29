# ChurchConnect — Architectural Decision Register (ADR)

This document records confirmed architectural decisions, dates of confirmation, evaluated alternatives, mandatory security refinements, and any remaining questions.

---

## 1. Confirmed Architectural Decisions

### ADR 001: Frontend Framework & Build Tooling
* **Decision:** Use React 19 with TypeScript and Vite.
* **Context:** Fast developer feedback loop, modern ES module support, native React 19 capabilities.
* **Confirmed Date:** October 18, 2026 (Milestone 1)
* **Status:** **[VERIFIED] CONFIRMED**

### ADR 002: Backend Architecture & Direct PostgreSQL Authorization
* **Decision:** Use Supabase PostgreSQL directly, relying on Row Level Security (RLS) for data authorization rather than building an intermediate Express/Node API server.
* **Context:** Eliminates redundant server infrastructure; PostgreSQL RLS ensures data cannot be accessed or modified without passing database security policies.
* **Confirmed Date:** October 18, 2026 (Milestone 1)
* **Status:** **[VERIFIED] CONFIRMED**

### ADR 003: User Profile & Identity Modeling
* **Decision:** Bind `public.profiles` directly to Supabase `auth.users(id)` with a foreign key (`ON DELETE CASCADE`). Avoid duplicating email and password hashes in a custom `users` table.
* **Context:** Prevents desynchronization between authentication tokens and member profiles.
* **Confirmed Date:** October 18, 2026 (Milestone 1)
* **Status:** **[VERIFIED] CONFIRMED**

### ADR 004: Visual Design Direction & Token Strategy
* **Decision:** Approved official identity: Forest Green (`#245747`), Deep Forest (`#142D25`), Sage Green (`#729985`), Soft Sage (`#DCE8DD`), Warm Ivory (`#FAF9F4`), White (`#FFFFFF`).
* **Context:** Warm, welcoming, respectful, and dignified aesthetic for church community.
* **Confirmed Date:** October 18, 2026 (Milestone 1)
* **Status:** **[VERIFIED] CONFIRMED**

### ADR 005 (DEC-001): Member Registration Workflow & Approval Gate
* **Decision:** Open registration with administrative approval. New user sign-ups default to `is_approved = FALSE`. Unapproved members are blocked by RLS from accessing the member directory, cell groups, or duty rosters until approved by an administrator.
* **Rationale:** Balances welcoming visitor onboarding with strict protection of congregation contact details.
* **Confirmed Date:** October 18, 2026 (Milestone 2B)
* **Status:** **[VERIFIED] CONFIRMED**

### ADR 006 (DEC-002): Permission Matrix Coexistence & Authoritative Engine
* **Decision:** Preserve existing `permissions` and `role_permissions` tables without deletion. Introduce modern `role_module_permissions` and `user_module_permissions` tables alongside them. Establish `has_module_permission()` as the single authoritative evaluation engine. Reconcile any legacy role rows via an audited mapping prior to cutover.
* **Rationale:** Protects historical database assets and eliminates risk of data loss, while enabling clean dual-tier CRUD administration.
* **Confirmed Date:** October 18, 2026 (Milestone 2B)
* **Status:** **[VERIFIED] CONFIRMED**

### ADR 007 (DEC-003): Sermon Media Hosting Architecture
* **Decision:** Store external streaming media links (YouTube Live/VOD, Vimeo) in `sermons.media_url` rather than uploading raw video/audio files directly to Supabase Storage.
* **Rationale:** Prevents storage quota exhaustion and egress bandwidth costs while providing reliable adaptive streaming.
* **Confirmed Date:** October 18, 2026 (Milestone 2B)
* **Status:** **[VERIFIED] CONFIRMED**

### ADR 008 (DEC-004): Single-Congregation Architecture with Multi-Campus Extension Path
* **Decision:** Design the initial database schema for a single congregation, but include an optional `campus_id` foreign key hook on ministries and events to ensure smooth future multi-campus scaling.
* **Rationale:** Keeps queries, forms, and filtering uncluttered for the immediate church context without creating costly structural debt.
* **Confirmed Date:** October 18, 2026 (Milestone 2B)
* **Status:** **[VERIFIED] CONFIRMED**

---

## 2. Mandatory Security Refinements (Milestone 2B Refinements)

### SEC-REF-01: Superadmin Precedence, User Overrides & Default Deny
* **Specification:** Authentication, account-integrity, and account-approval checks occur first. A valid, authenticated, approved user with the canonical `superadmin` assignment bypasses ordinary `user_module_permissions` overrides, including explicit per-user `FALSE` and `TRUE` values. Evaluate this exception before per-user overrides. This is a precedence rule only: it does not itself grant any module/action capability and does not bypass applicable record/ministry scope, database constraints, audit requirements, or other approved safeguards.
* **Non-superadmin behavior:** An explicit per-user `FALSE` denies the action; an explicit per-user `TRUE` is considered only subject to all applicable safeguards; otherwise evaluate an applicable approved role/module grant.
* **Default deny:** Missing or `PENDING` role/module/action decisions deny access. No grants may be inferred from role names or automatically translated from legacy `permissions` / `role_permissions` rows.
* **Confirmed owner decision:** October 28, 2026.
* **Status:** **[CONFIRMED PRECEDENCE; ROLE/MODULE GRANTS STILL PENDING]**

### SEC-REF-02: Hardened `SECURITY DEFINER` Function Standards
* **Specification:** Every database authorization helper function must:
  1. Be owned strictly by `postgres`.
  2. Set fixed `search_path = public, pg_temp;`.
  3. Fully qualify all table references with `public.`.
  4. Revoke public execute rights (`REVOKE ALL FROM PUBLIC;`).
  5. Ground caller identity in `auth.uid()`, ignoring spoofable caller parameters.
  6. Avoid all dynamic SQL.
* **Status:** **[CONFIRMED SPECIFICATION]**

### SEC-REF-03: Last-Active-Superadmin Invariant (Implementation Requirement)
* **Requirement:** Preserve at least one active, approved user with a valid global `superadmin` assignment. The implementation must serialize competing changes and validate the invariant inside the same transaction.
* **Coverage required:** Review every path that can remove or invalidate the final superadmin, including `user_roles` INSERT/UPDATE/DELETE, profile approval/status changes, role deletion or mutation, `auth.users` deletion and cascading effects, and any trusted administrative workflow. A lock on the lowercase canonical role row `public.roles.id = 'superadmin'` may be part of the design, but is not sufficient unless every relevant path participates and the invariant is rechecked after the proposed mutation.
* **Verification required:** Test concurrent operations using independent database sessions and prove that all failure paths roll back without leaving zero active approved superadmins.
* **Status:** **[REQUIRED; NOT YET IMPLEMENTED OR VERIFIED]**

---

## 3. Decisions and Controls Still Blocking Migration Execution

The following remain open. Planning documents do not authorize execution, and no database migration should be applied merely because a draft exists.

1. **Role/module/action grants:** Owner review of all 72 role/module pairs. CRUD cells remain `PENDING`; pending decisions fail closed.
2. **Special capabilities:** Define `manage`, `approve`, and `assign` independently, including scope and who may exercise each capability.
3. **Public data exposure:** Inventory the actual tables and columns, then approve a narrow anonymous-read allowlist. Do not add broad `anon` access for the currently static public homepage.
4. **Role hierarchy and delegation:** Approve a schema-backed hierarchy and exact role-assignment rules before implementing delegation. Role names do not establish ordering.
5. **Trusted administrative workflows:** Inventory external/server-side and service-role consumers before applying privilege revocations; design narrow, auditable transactional operations for approval and role changes.
6. **Last-superadmin protection:** Implement and test the invariant across every mutation and deletion path, including concurrency and cascading effects.
7. **Application authentication:** Replace the demo login with real Supabase Auth session handling and route UX guards; database RLS remains the security boundary.
8. **Validation and rollback:** Confirm a restorable staging backup, review the effects of the strict privilege draft, and run catalog plus real-JWT behavioral tests in staging before considering any production plan.

**Execution gate:** The authorization-foundation draft remains review-only and unapplied unless the owner explicitly approves staging execution after the above checks. Production remains out of scope without separate explicit authorization.
