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

### SEC-REF-01: Explicit User-Denial Precedence & Default Deny
* **Specification:** In `has_module_permission()`, an explicit per-user denial (`user_module_permissions.can_<action> = FALSE`) strictly overrides any and all role grants (including administrative roles). When neither an explicit user grant nor an applicable role grant exists, the system defaults to deny.
* **Status:** **[CONFIRMED SPECIFICATION]**

### SEC-REF-02: Hardened `SECURITY DEFINER` Function Standards
* **Specification:** Every database authorization helper function must:
  1. Be owned strictly by `postgres`.
  2. Set fixed `search_path = public, pg_temp;`.
  3. Fully qualify all table references with `public.`.
  4. Revoke public execute rights (`REVOKE ALL FROM PUBLIC;`).
  5. Ground caller identity in `auth.uid()`, ignoring spoofable caller parameters.
  6. Avoid all dynamic SQL.
* **Status:** **[CONFIRMED SPECIFICATION]**

### SEC-REF-03: Transactional, Concurrency-Safe Last-SUPERADMIN Protection
* **Specification:** All mutations affecting the `SUPERADMIN` role or SUPERADMIN user profiles must acquire an exclusive row-level lock on `public.roles WHERE id = 'SUPERADMIN' FOR UPDATE` within the mutation transaction. This serializes concurrent demotions and guarantees that at least one active SUPERADMIN remains.
* **Status:** **[CONFIRMED SPECIFICATION]**

---

## 3. Decisions Blocking Migration Execution (None Remaining for Milestone 2B)

With DEC-001 through DEC-004 approved and the three security refinements formalized, **no architectural decisions remain that block migration planning**. 

Execution of migrations remains strictly gated until the user reviews Milestone 2B planning documents and explicitly authorizes Milestone 2C (Implementation).
