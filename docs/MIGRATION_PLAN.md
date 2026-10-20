# ChurchConnect — Milestone 2B: Database Migration & Implementation Plan

**Document Status:** Planning-Only (Approved Architecture Blueprint)  
**Execution Authority:** **No execution authorized.** SQL execution, schema creation, data alteration, and package installation are strictly prohibited during Milestone 2B.  
**Prerequisites:** Completed Milestone 2A Audit ([`docs/DATABASE_AUDIT.md`](file:///c:/Users/user/.gemini/antigravity-ide/scratch/churchconnect/docs/DATABASE_AUDIT.md)) and User Confirmation on DEC-001 through DEC-004.

---

## 1. Executive Summary & Core Invariants

This document establishes the versioned, phase-by-phase migration plan to transition ChurchConnect's database from its prototype state into a production-grade, dual-tier permission architecture.

### Confirmed Architectural Decisions Incorporated
* **DEC-001 (Approved):** Open member registration with administrative approval gatekeeping (`is_approved = FALSE` by default).
* **DEC-002 (Approved):** Coexistence of modern dual-tier permission matrix (`role_module_permissions`, `user_module_permissions`) alongside legacy `permissions` and `role_permissions`, with one authoritative evaluation engine.
* **DEC-003 (Approved):** External streaming media links (YouTube, Vimeo) stored initially to preserve Supabase storage quotas.
* **DEC-004 (Approved):** Single-congregation architecture with documented expansion hooks for future multi-campus scaling.

---

## 2. Current-State Database Inventory

Based on empirical read-only introspection conducted in Milestone 2A:

### A. The 7 Confirmed Existing Tables

| Table Name | Primary Key | Verified Existing Columns | Incomplete Metadata / Unverified Attributes |
| :--- | :--- | :--- | :--- |
| `public.profiles` | `id` (UUID) | `id`, `full_name`, `created_at`, `updated_at` | Row count `[UNVERIFIED]`, existing FKs `[UNVERIFIED]`, indexes `[UNVERIFIED]` |
| `public.ministries` | `id` (UUID) | `id`, `name`, `description`, `is_active`, `created_at` | Row count `[UNVERIFIED]`, existing constraints `[UNVERIFIED]` |
| `public.modules` | `id` (TEXT) | `id`, `name`, `description`, `is_active` | Row count `[UNVERIFIED]`, default row contents `[UNVERIFIED]` |
| `public.roles` | `id` (TEXT) | `id`, `name`, `description` | Row count `[UNVERIFIED]`, existing role names `[UNVERIFIED]` |
| `public.permissions` | `id` (UUID) | `id`, `module_id` (TEXT), `action` (TEXT) | Row count `[UNVERIFIED]`, existing permission entries `[UNVERIFIED]` |
| `public.role_permissions`| Composite | `role_id` (TEXT), `permission_id` (UUID) | Row count `[UNVERIFIED]`, legacy mapping `[UNVERIFIED]` |
| `public.user_roles` | `id` (UUID) | `id`, `user_id` (UUID), `role_id` (TEXT), `assigned_by` (UUID), `created_at` | Row count `[UNVERIFIED]`, existing assignments `[UNVERIFIED]` |

### B. Confirmed Non-Existent Tables
* `public.users` (Avoided in favor of `auth.users`), `public.system_roles`, `public.system_role_permissions`, `public.user_system_roles`, `public.app_modules`, `public.events`, `public.sermons`, `public.announcements`.

### C. Mandatory Pre-Generation Schema Inventory Checklist
**Execution Gate:** Before authoring any SQL migration script in Milestone 2C, an authorized administrator must execute the following read-only queries against Supabase to eliminate unverified assumptions:

1. **Existing Record Counts (Admin Session):**
   ```sql
   SELECT 'profiles' AS tbl, count(*) FROM public.profiles
   UNION ALL SELECT 'ministries', count(*) FROM public.ministries
   UNION ALL SELECT 'modules', count(*) FROM public.modules
   UNION ALL SELECT 'roles', count(*) FROM public.roles
   UNION ALL SELECT 'permissions', count(*) FROM public.permissions
   UNION ALL SELECT 'role_permissions', count(*) FROM public.role_permissions
   UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles;
   ```
2. **Foreign Keys & Constraints:**
   ```sql
   SELECT conname, contype, conrelid::regclass, confrelid::regclass 
   FROM pg_constraint 
   WHERE connamespace = 'public'::regnamespace;
   ```
3. **Existing RLS Policies:**
   ```sql
   SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```
4. **Existing Triggers & Stored Functions:**
   ```sql
   SELECT trigger_name, event_manipulation, event_object_table, action_statement 
   FROM information_schema.triggers 
   WHERE trigger_schema = 'public';
   ```
5. **Legacy Role Permissions Mapping (DEC-002 Preflight):**
   ```sql
   SELECT rp.role_id, p.module_id, p.action, count(*) 
   FROM public.role_permissions rp
   JOIN public.permissions p ON p.id = rp.permission_id
   GROUP BY rp.role_id, p.module_id, p.action;
   ```
6. **Authentication Users (Non-PII):**
   ```sql
   SELECT count(*) AS total_auth_users FROM auth.users;
   ```

---

## 3. Proposed 9-Phase Migration Sequence

```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Read-Only Preflight & Backup Verification     │
├────────────────────────────────────────────────────────┤
│ Phase 2: Additive Schema Enhancements                  │
├────────────────────────────────────────────────────────┤
│ Phase 3: Permission Matrix & Legacy Reconciliation     │
├────────────────────────────────────────────────────────┤
│ Phase 4: Hardened Security-Definer Helper Functions    │
├────────────────────────────────────────────────────────┤
│ Phase 5: Granular RLS Policies & Privilege Revocation  │
├────────────────────────────────────────────────────────┤
│ Phase 6: Registration & Administrative Approval Gate   │
├────────────────────────────────────────────────────────┤
│ Phase 7: Protected Role Assignment & Last-SUPERADMIN   │
├────────────────────────────────────────────────────────┤
│ Phase 8: Staging Security Verification & Testing       │
├────────────────────────────────────────────────────────┤
│ Phase 9: Controlled Production Release Readiness       │
└────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Separation of Authoring vs. Execution:**  
> 1. **Milestone 2B (Current):** Architectural planning and validation only. Zero SQL generation; zero execution.  
> 2. **Milestone 2C (Next):** Authoring static SQL migration scripts into `supabase/migrations/` (repository files only; NO live execution).  
> 3. **Milestone 2D (Staging Execution):** Gated by an explicit user authorization *after* the static SQL scripts are reviewed.

---

### Phase 1: Read-Only Preflight & Backup Verification
* **Identifier:** `MIG-P01-PREFLIGHT`
* **Purpose:** Ensure a verified, reproducible database snapshot exists before altering schema, and confirm active schema inventory.
* **Preconditions:** Administrative Supabase credentials available in a secure environment.
* **Proposed Actions:**
  * Execute `supabase db dump --data --schema public > backup_pre_milestone2.sql`.
  * Compute SHA-256 hash of the backup file and record it.
  * Verify backup integrity by performing a trial restore into an isolated local/staging database container.
  * Execute the Section 2.C preflight queries to establish the empirical schema inventory.
* **Affected Data:** None (read-only).
* **Rollback Strategy:** N/A.
* **Acceptance Criteria:** Backup file verified and tested for clean restoration; empirical inventory recorded.

---

### Phase 2: Additive Schema Enhancements
* **Identifier:** `MIG-P02-ADDITIVE-SCHEMA`
* **Purpose:** Safely add required attributes to existing tables without breaking backward compatibility.
* **Preconditions:** Phase 1 complete.
* **Proposed Objects & Columns:**
  * `public.profiles`:
    * `ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;`
    * `ADD COLUMN IF NOT EXISTS approval_date TIMESTAMPTZ;`
    * `ADD COLUMN IF NOT EXISTS phone_number TEXT;`
    * `ADD COLUMN IF NOT EXISTS avatar_url TEXT;`
  * `public.roles`:
    * `ADD COLUMN IF NOT EXISTS hierarchy_level INT NOT NULL DEFAULT 50;`
    * `ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN NOT NULL DEFAULT FALSE;`
    * `ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
  * `public.ministries`:
    * `ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;`
* **Existing Data Affected:** Existing rows receive safe default values (`is_approved = FALSE`, `is_system_role = FALSE`, `hierarchy_level = 50`).
* **Verification Queries:**
  ```sql
  SELECT column_name, data_type, is_nullable, column_default 
  FROM information_schema.columns 
  WHERE table_name IN ('profiles', 'roles', 'ministries') AND table_schema = 'public';
  ```
* **Rollback Strategy:** Columns are strictly additive. Rollback script executes `ALTER TABLE ... DROP COLUMN ...`.
* **Acceptance Criteria:** New columns present, existing data intact.

---

### Phase 3: Permission Matrix Introduction & Legacy Reconciliation (DEC-002)
* **Identifier:** `MIG-P03-PERMISSION-MATRIX`
* **Purpose:** Introduce modern dual-tier permission tables alongside legacy tables and seed initial modules and roles.
* **Preconditions:** Phase 2 complete.
* **Proposed Objects:**
  * Create `public.role_module_permissions`:
    ```sql
    CREATE TABLE IF NOT EXISTS public.role_module_permissions (
      role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
      can_view BOOLEAN NOT NULL DEFAULT FALSE,
      can_create BOOLEAN NOT NULL DEFAULT FALSE,
      can_update BOOLEAN NOT NULL DEFAULT FALSE,
      can_delete BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (role_id, module_id)
    );
    ```
  * Create `public.user_module_permissions`:
    ```sql
    CREATE TABLE IF NOT EXISTS public.user_module_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
      can_view BOOLEAN,   -- NULL: inherit role; TRUE: explicit grant; FALSE: explicit deny
      can_create BOOLEAN,
      can_update BOOLEAN,
      can_delete BOOLEAN,
      granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_user_module UNIQUE (user_id, module_id)
    );
    ```
  * Seed the 12 Approved Modules into `public.modules`:
    `registration`, `ministry`, `cms`, `portal`, `cell_groups`, `youth`, `children`, `women`, `men`, `evangelism`, `praise_worship`, `sunday_service` using `ON CONFLICT (id) DO UPDATE`.
  * Seed the 6 Approved System Roles into `public.roles`:
    * `SUPERADMIN` (level 0, `is_system_role = TRUE`)
    * `COUNCIL` (level 10, `is_system_role = TRUE`)
    * `ADMIN` (level 20, `is_system_role = TRUE`)
    * `LEADER` (level 30, `is_system_role = TRUE`)
    * `VOLUNTEER` (level 40, `is_system_role = TRUE`)
    * `MEMBER` (level 50, `is_system_role = TRUE`)
  * Populate baseline CRUD matrix in `role_module_permissions`.
* **Legacy Reconciliation Process:**
  * Legacy tables `permissions` and `role_permissions` are **preserved untouched**.
  * A pre-migration audit query will check if any custom rows exist in `role_permissions`. If found, a one-time mapping script will translate those mappings into equivalent `role_module_permissions` entries before cutover.
  * The single authoritative permission engine (Phase 4) reads exclusively from `user_module_permissions` and `role_module_permissions`.
* **Verification Queries:**
  ```sql
  SELECT count(*) FROM public.modules; -- Expect >= 12
  SELECT count(*) FROM public.roles;   -- Expect >= 6
  SELECT count(*) FROM public.role_module_permissions;
  ```
* **Rollback Strategy:** Drop `user_module_permissions` and `role_module_permissions`.
* **Acceptance Criteria:** Modules and roles seeded; matrix queryable.

---

### Phase 4: Hardened Security-Definer Helper Functions
* **Identifier:** `MIG-P04-SECDEF-FUNCTIONS`
* **Purpose:** Create high-performance, recursion-proof authorization helper functions for RLS policies.
* **Preconditions:** Phase 3 complete.
* **Proposed Functions:**
  1. `public.is_superadmin() -> BOOLEAN` (Evaluates `auth.uid()`; zero caller parameter to prevent forgery)
  2. `public.is_approved_member() -> BOOLEAN` (Evaluates `auth.uid()`; zero caller parameter)
  3. `public.has_module_permission(p_module TEXT, p_action TEXT) -> BOOLEAN` (Evaluates `auth.uid()`)
* **Hardening Requirements Applied:**
  * Owned by administrative role (`postgres`).
  * Explicit `SET search_path = public, pg_temp;`.
  * Strict schema-qualified table references (`public.user_roles`, `public.profiles`).
  * `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;` and `GRANT EXECUTE TO authenticated, anon;`.
  * Identity strictly grounded in `auth.uid()`. Dynamic SQL prohibited.
* **Verification Queries:**
  ```sql
  -- Verify function definitions and search_path settings
  SELECT proname, prosecdef, proconfig 
  FROM pg_proc 
  WHERE proname IN ('is_superadmin', 'is_approved_member', 'has_module_permission');
  ```
* **Rollback Strategy:** `DROP FUNCTION IF EXISTS ...;`.
* **Acceptance Criteria:** Functions execute cleanly without recursion and accurately evaluate permissions.

---

### Phase 5: Granular RLS Policies & Privilege Revocation
* **Identifier:** `MIG-P05-RLS-POLICIES`
* **Purpose:** Enforce strict default-deny authorization on all tables with explicit operation boundaries.
* **Preconditions:** Phase 4 complete.
* **Idempotency Strategy:**
  * In PostgreSQL, `CREATE POLICY` does not support `IF NOT EXISTS`.
  * Migration files must author: `DROP POLICY IF EXISTS "<policy_name>" ON <table_name>;` followed by `CREATE POLICY "<policy_name>" ON <table_name> ...;` to ensure 100% idempotent re-runnability.
* **Proposed Policies:**
  * `public.profiles`:
    * `SELECT`: Users read their own profile; approved members read basic profiles of other approved members; admins read all.
    * `INSERT`: Only auth triggers or authenticated self-registration.
    * `UPDATE`: Users update personal fields only; changing `is_approved` requires admin privileges.
    * `DELETE`: Admin only.
  * `public.modules` & `public.roles`:
    * `SELECT`: Readable by authenticated users.
    * `INSERT / UPDATE / DELETE`: Restricted to `SUPERADMIN`.
  * `public.user_roles`:
    * `SELECT`: Users read their own roles; admins read all.
    * `INSERT / UPDATE / DELETE`: Superadmins and authorized admins only (restricted by hierarchy).
  * `public.user_module_permissions` & `public.role_module_permissions`:
    * `SELECT`: Authenticated users.
    * `INSERT / UPDATE / DELETE`: Admins only.
* **Verification Queries:** Run simulated test queries as unauthenticated, member, and admin roles.
* **Rollback Strategy:** Revert to prototype baseline RLS policies.
* **Acceptance Criteria:** Zero unauthorized reads or writes permitted.

---

### Phase 6: Registration & Administrative Approval Gate (DEC-001)
* **Identifier:** `MIG-P06-APPROVAL-WORKFLOW`
* **Purpose:** Implement automatic profile creation and enforce the member approval gate.
* **Preconditions:** Phase 5 complete.
* **Idempotency Strategy:**
  * Use `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;` and `DROP TRIGGER IF EXISTS protect_profile_approval ON public.profiles;` prior to `CREATE TRIGGER`.
* **Proposed Objects:**
  * Create `AFTER INSERT ON auth.users` trigger:
    Automatically inserts into `public.profiles` (`id = NEW.id`, `full_name = NEW.raw_user_meta_data->>'full_name'`, `is_approved = FALSE`).
  * Automatically assigns default `'MEMBER'` role in `public.user_roles`.
  * Add protective `BEFORE UPDATE ON public.profiles` trigger:
    Blocks non-administrators from altering `is_approved` or `approval_date`.
* **Verification Queries:** Check trigger registration in `information_schema.triggers`.
* **Rollback Strategy:** Drop triggers `on_auth_user_created` and `protect_profile_approval`.
* **Acceptance Criteria:** New user creation produces an unapproved profile; self-approval attempts raise exceptions.

---

### Phase 7: Protected Role Assignment & Transactional SUPERADMIN Safeguards
* **Identifier:** `MIG-P07-SUPERADMIN-GUARD`
* **Purpose:** Guarantee system role immutability and prevent removal of the last active SUPERADMIN under concurrent transactions across all mutation vectors.
* **Preconditions:** Phase 6 complete.
* **Idempotency Strategy:**
  * Use `DROP TRIGGER IF EXISTS ...` before `CREATE TRIGGER`.
* **Proposed Objects:**
  * Create `BEFORE UPDATE OR DELETE ON public.roles` trigger:
    Blocks modification or deletion of rows where `is_system_role = TRUE`.
  * Create `BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles` trigger:
    Acquires exclusive row-level lock on `roles WHERE id = 'SUPERADMIN' FOR UPDATE` for all promotions, demotions, or removals; verifies caller is SUPERADMIN; verifies at least one approved active SUPERADMIN remains.
  * Create `BEFORE UPDATE OR DELETE ON public.profiles` trigger:
    Acquires exclusive row-level lock on `roles WHERE id = 'SUPERADMIN' FOR UPDATE` if target user is SUPERADMIN; blocks profile deletion or deactivation (`is_approved = FALSE`) if it would leave zero active SUPERADMINs.
* **Verification Queries:** Inspect trigger definitions in `information_schema.triggers` and verify lock acquisition statements.
* **Rollback Strategy:** Drop protection triggers.
* **Acceptance Criteria:** Concurrency lock serializes transactions; system roles protected across all 6 mutation paths.

---

### Phase 8: Staging Security Verification & Testing
* **Identifier:** `MIG-P08-TEST-VERIFICATION`
* **Purpose:** Execute the comprehensive test suite in an isolated staging environment.
* **Preconditions:** Phases 1–7 executed in staging after separate explicit authorization.
* **Proposed Actions:**
  * Execute all 29 test cases defined in [`docs/SECURITY_TEST_PLAN.md`](file:///c:/Users/user/.gemini/antigravity-ide/scratch/churchconnect/docs/SECURITY_TEST_PLAN.md).
  * Run two-session concurrent demotion test (`SUP-02`).
  * Run concurrent promotion/demotion test (`SUP-05`).
* **Rollback Strategy:** Reset staging environment from Phase 1 backup if any critical test fails.
* **Acceptance Criteria:** 100% pass rate on all critical and high-severity test cases.

---

### Phase 9: Controlled Production Release Readiness
* **Identifier:** `MIG-P09-PROD-RELEASE`
* **Purpose:** Final production deployment checklist and post-cutover smoke test.
* **Preconditions:** Phase 8 sign-off and explicit user authorization.
* **Proposed Actions:**
  * Execute migrations in sequential transaction blocks.
  * Verify post-deployment row counts and connectivity.
  * Confirm frontend builds cleanly with zero errors.
* **Acceptance Criteria:** All Go/No-Go criteria satisfied.

---

## 4. Data Preservation & Legacy Compatibility Strategy

1. **Strictly Non-Destructive DDL:**
   * No `DROP TABLE`, `TRUNCATE`, or `ALTER TABLE ... DROP COLUMN` will be executed during migration.
   * All schema modifications are purely additive (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
2. **Foreign Key Integrity:**
   * Existing `profiles.id` foreign keys to `auth.users(id)` are preserved.
   * New tables link to `public.profiles(id)` using `ON DELETE CASCADE` (for user-owned data) or `ON DELETE SET NULL` (for audit columns like `assigned_by`).
3. **Legacy Permission Table Coexistence (DEC-002):**
   * Legacy tables `permissions` and `role_permissions` remain intact.
   * The new evaluation engine (`has_module_permission()`) acts as the single source of truth.
   * Explicit per-user denials in `user_module_permissions` cannot be bypassed by legacy permission grants because the evaluation engine inspects user denials *before* evaluating any role grant.
4. **Rollback Limitations vs. Forward Recovery:**
   * **Pre-Cutover Rollback:** If a fatal flaw is discovered *prior* to public cutover or live data creation, the system can cleanly roll back using the paired `rollback_0001.sql` script or restore from the Phase 1 backup snapshot.
   * **Post-Live Forward Recovery:** Once live member accounts or administrative records have been registered, dropping columns (e.g. `ALTER TABLE profiles DROP COLUMN is_approved`) would irrevocably destroy newly created member approval statuses and audit metadata. Therefore, in any post-live scenario, **forward-fixing migrations are strictly required** rather than destructive schema rollbacks.

---

## 5. Go/No-Go Release Checklist

Every item on this checklist must pass before authorizing production execution:

* [ ] **1. Fresh Snapshot Verified:** Verified Supabase database backup successfully taken and restore-tested.
* [ ] **2. Existing Row Inventory Confirmed:** Admin read-only query verified row counts of all 7 existing tables.
* [ ] **3. Legacy Rows Reconciled:** Verified whether any custom rows exist in `role_permissions` that require mapping.
* [ ] **4. Additive Changes Only:** Migration script contains zero destructive statements (`DROP`, `TRUNCATE`).
* [ ] **5. Hardened SECURITY DEFINER Functions:** Every helper function has fixed `search_path` and validated caller identity.
* [ ] **6. Granular RLS Policies Defined:** No blanket `FOR ALL` policies; distinct policies per operation.
* [ ] **7. Concurrency Lock Demonstrated:** Two-session concurrency test passed in staging without race-condition lockout.
* [ ] **8. Member Approval Gate Verified:** Unapproved member blocked from viewing directory data.
* [ ] **9. Self-Approval Blocked:** Direct API attempt to update `is_approved` fails with an authorization error.
* [ ] **10. Zero Secrets Exposed:** No credentials or private keys in code, logs, or repository files.

**A failure on ANY of the 10 criteria constitutes an immediate NO-GO.**
