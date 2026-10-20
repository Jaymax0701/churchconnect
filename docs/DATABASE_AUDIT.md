# ChurchConnect — Milestone 2A: Database Security Audit & Schema Verification

**Audit Date:** October 18, 2026  
**Audit Scope:** Active Supabase PostgreSQL Database, Prototype Assets, and Authorization Architecture  
**Execution Standard:** Strictly Read-Only Inspection. Zero Destructive Operations. Zero Credential Exposure.

---

## 1. Executive Summary

ChurchConnect has transitioned from Milestone 1 (Frontend Foundation & Visual Polish) into **Milestone 2 (Database Architecture & Security)**. 

Prior to proposing any database migration or schema alteration, an exhaustive, read-only empirical audit of the active Supabase PostgreSQL database was conducted. This audit cross-referenced existing database tables against historical prototype implementations (`church-website-app` and `ministry-schedule-app`), identified critical relational discrepancies, evaluated Row Level Security (RLS) enforcement, and mapped out a secure, non-destructive migration trajectory.

---

## 2. Audit Methodology & Verification Protocol

In strict adherence to the project rules:
1. **Zero Destructive Operations:** No database objects (`TABLE`, `VIEW`, `INDEX`, `TRIGGER`, `FUNCTION`) were created, altered, dropped, or seeded.
2. **Zero Modification:** No database records were added, updated, or deleted.
3. **Zero Credential Exposure:** Environment variables and secrets were never committed or logged in output.
4. **Empirical Verification:** Table existence, column definitions, and primary/foreign key data types were probed using PostgREST schema introspection via the authorized public publishable key.

---

## 3. Empirical Schema Findings: Active Supabase Database

The following findings represent the confirmed state of the connected Supabase instance:

### A. Confirmed Existing Tables (7 Tables)

| Table Name | Status | Primary Key | Confirmed Column Names |
| :--- | :--- | :--- | :--- |
| `public.profiles` | **[VERIFIED]** | `id` (UUID) | `id`, `full_name`, `created_at`, `updated_at` |
| `public.ministries` | **[VERIFIED]** | `id` (UUID) | `id`, `name`, `description`, `is_active`, `created_at` |
| `public.modules` | **[VERIFIED]** | `id` (TEXT) | `id`, `name`, `description`, `is_active` |
| `public.roles` | **[VERIFIED]** | `id` (TEXT) | `id`, `name`, `description` |
| `public.permissions` | **[VERIFIED]** | `id` (UUID) | `id`, `module_id` (TEXT), `action` (TEXT) |
| `public.role_permissions`| **[VERIFIED]** | Composite (`role_id`, `permission_id`) | `role_id` (TEXT), `permission_id` (UUID) |
| `public.user_roles` | **[VERIFIED]** | `id` (UUID) | `id`, `user_id` (UUID), `role_id` (TEXT), `assigned_by` (UUID), `created_at` |

### B. Confirmed Key & Identifier Types

* **[VERIFIED]** `profiles.id` is type `UUID` and directly references `auth.users(id)`.
* **[VERIFIED]** `modules.id` uses `TEXT` identifiers (e.g., `'registration'`, `'ministry'`, `'cms'`).
* **[VERIFIED]** `roles.id` uses `TEXT` identifiers (e.g., `'SUPERADMIN'`, `'ADMIN'`).
* **[VERIFIED]** `permissions.id` uses `UUID`.
* **[VERIFIED]** `ministries.id` uses `UUID`.
* **[VERIFIED]** `permissions.module_id` is `TEXT` referencing `modules.id`.
* **[VERIFIED]** `role_permissions.role_id` is `TEXT` referencing `roles.id`.
* **[VERIFIED]** `role_permissions.permission_id` is `UUID` referencing `permissions.id`.
* **[VERIFIED]** `user_roles.user_id` is `UUID` (references `auth.users(id)`).
* **[VERIFIED]** `user_roles.role_id` is `TEXT` (references `roles.id`).
* **[VERIFIED]** `user_roles.assigned_by` is `UUID` (references `auth.users(id)`).

### C. Confirmed Non-Existent Tables (404 PGRST205)

The following candidate tables from earlier prototypes or design sketches **do not exist** in the active Supabase schema:
* **[VERIFIED]** `public.users` (PGRST205: Not in schema cache — confirms custom user table was avoided).
* **[VERIFIED]** `public.system_roles` (PGRST205 — historical prototype table name).
* **[VERIFIED]** `public.system_role_permissions` (PGRST205).
* **[VERIFIED]** `public.user_system_roles` (PGRST205).
* **[VERIFIED]** `public.app_modules` (PGRST205 — the active table is named `modules`).
* **[VERIFIED]** `public.events` (PGRST205 — not yet created).
* **[VERIFIED]** `public.sermons` (PGRST205 — not yet created).
* **[VERIFIED]** `public.announcements` (PGRST205 — not yet created).

### D. Row Level Security (RLS) Status

* **[VERIFIED]** Row Level Security is **ENABLED** on `profiles`, `roles`, `modules`, and `user_roles`.
* **[VERIFIED]** Direct anonymous `INSERT` attempts fail with PostgreSQL error:
  `code=42501, message=new row violates row-level security policy for table "<table_name>"`.
* **[VERIFIED]** Direct anonymous `SELECT` returns 0 records due to default-deny policies without authenticated session tokens.

---

## 4. Gap Analysis: Active Database vs. Planned Architecture

Comparing the active schema against ChurchConnect's Milestone 2 requirements reveals crucial architectural gaps that must be resolved through an orderly, non-destructive migration:

```
┌──────────────────────────────┬──────────────────────────────┬────────────────────────────────────────────────────────┐
│ Target Requirement           │ Active Database State        │ Architectural Gap & Action Needed                      │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────┤
│ Member Approval Gatekeeping  │ profiles has no is_approved  │ [PROPOSED] ALTER TABLE profiles ADD COLUMN             │
│                              │ or approval_date             │ is_approved BOOLEAN NOT NULL DEFAULT FALSE,            │
│                              │                              │ ADD COLUMN approval_date TIMESTAMPTZ;                  │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────┤
│ Member Contact Details       │ profiles has no phone_number │ [PROPOSED] ALTER TABLE profiles ADD COLUMN             │
│                              │ or avatar_url                │ phone_number TEXT, ADD COLUMN avatar_url TEXT;        │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────┤
│ Dual-Tier Module CRUD        │ role_permissions references  │ [PROPOSED] Migrate to explicit CRUD model:             │
│ Permissions                  │ discrete action rows in      │ - Add role_module_permissions (role_id, module_id,     │
│                              │ permissions table            │   can_view, can_create, can_update, can_delete)       │
│                              │                              │ - Add user_module_permissions (user_id, module_id,     │
│                              │                              │   can_view, can_create, can_update, can_delete)       │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────┤
│ System Role Protection       │ roles has no is_system_role  │ [PROPOSED] ALTER TABLE roles ADD COLUMN                │
│                              │ or hierarchy_level           │ is_system_role BOOLEAN NOT NULL DEFAULT FALSE,         │
│                              │                              │ ADD COLUMN hierarchy_level INT NOT NULL DEFAULT 50;    │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────┤
│ 12 Standard Feature Modules  │ modules table present;       │ [PROPOSED] Verify existing rows via admin query        │
│                              │ anonymous SELECT returned 0  │ [UNVERIFIED]. Seed approved modules using              │
│                              │ records due to RLS policy    │ ON CONFLICT (id) DO UPDATE.                            │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────────────┤
│ 6 Standard Church Roles      │ roles table present;         │ [PROPOSED] Verify existing rows via admin query        │
│                              │ anonymous SELECT returned 0  │ [UNVERIFIED]. Seed approved roles using                │
│                              │ records due to RLS policy    │ ON CONFLICT (id) DO UPDATE.                            │
└──────────────────────────────┴──────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 5. Security Vulnerability Assessment & Threat Modeling

### Threat 1: Recursive RLS Loops (Circular Policy Dependency)
* **Risk:** High.
* **Mechanism:** If an RLS policy on `public.profiles` or `public.user_roles` executes `SELECT ... FROM public.user_roles WHERE user_id = auth.uid()`, and `user_roles` itself has an RLS policy requiring a role check, PostgreSQL enters an infinite recursion loop, resulting in HTTP 500 / `infinite recursion detected in policy for relation`.
* **Mitigation:** **[PROPOSED]** All administrative and role checks must be encapsulated in PostgreSQL functions marked `SECURITY DEFINER` with an explicit search path (`SET search_path = public, pg_temp;`). Inside security-definer functions, row checks bypass recursive RLS evaluation safely.

### Threat 2: Member Self-Approval & Privilege Escalation
* **Risk:** Critical.
* **Mechanism:** If a standard member issues `supabase.from('profiles').update({ is_approved: true })` using their authenticated session, an unconstrained `UPDATE` policy (`USING (id = auth.uid())`) will permit them to approve themselves.
* **Mitigation:** **[PROPOSED]**
  1. Split profile updates: Regular users may only update personal fields (`full_name`, `phone_number`, `avatar_url`).
  2. The `is_approved`, `approval_date`, and role fields must be shielded by a PostgreSQL trigger or an RLS `WITH CHECK` expression that asserts `(is_approved IS NOT DISTINCT FROM profiles.is_approved OR public.is_admin())`.

### Threat 3: Last-SUPERADMIN Lockout Under Concurrent Transactions
* **Risk:** Critical.
* **Mechanism:** A naive trigger that checks `SELECT COUNT(*) FROM user_roles WHERE role_id = 'SUPERADMIN'` prior to a `DELETE` or `UPDATE` is vulnerable to a race condition. If two SUPERADMINs are concurrently removed or demoted in separate transactions:
  * Transaction A reads `count = 2` (permits demotion).
  * Transaction B simultaneously reads `count = 2` (permits demotion).
  * Both transactions commit, leaving **zero** active SUPERADMINs in the system.
* **Mitigation:** **[PROPOSED]**
  The demotion/deletion trigger must serialize on a synchronization lock before evaluating the count:
  ```sql
  -- Acquire exclusive row lock on the SUPERADMIN role record to serialize concurrent demotions
  PERFORM 1 FROM public.roles WHERE id = 'SUPERADMIN' FOR UPDATE;
  
  SELECT COUNT(*) INTO active_superadmins
  FROM public.user_roles
  WHERE role_id = 'SUPERADMIN' AND user_id != OLD.user_id;
  
  IF active_superadmins < 1 THEN
    RAISE EXCEPTION 'Safety Violation: Cannot remove or demote the last remaining SUPERADMIN.';
  END IF;
  ```

### Threat 4: Unauthorized Role & Permission Escalation
* **Risk:** Critical.
* **Mechanism:** A malicious or compromised `MINISTRY_LEADER` or `Church Admin` attempts to grant themselves or a peer the `SUPERADMIN` role.
* **Mitigation:** **[PROPOSED]**
  A PostgreSQL `BEFORE INSERT OR UPDATE ON public.user_roles` trigger must enforce:
  1. Only existing `SUPERADMIN` users can assign or revoke the `SUPERADMIN` role.
  2. Non-superadmins cannot modify records where `role_id = 'SUPERADMIN'`.
  3. Role assignments must not exceed the actor's hierarchical authority level (`roles.hierarchy_level`).

---

## 6. Migration & Rollback Strategy

* **Phase 1: Backup Requirement:** Prior to executing any DDL, take a snapshot backup using the Supabase CLI (`supabase db dump`) or Supabase Dashboard backup utility.
* **Phase 2: Additive Column Migrations:** Add missing columns to `profiles`, `roles`, and `ministries` with safe defaults (`is_approved DEFAULT FALSE`, `is_system_role DEFAULT FALSE`).
* **Phase 3: Module & Role Seed Population:** Insert approved modules and roles using `ON CONFLICT (id) DO UPDATE` to ensure idempotency.
* **Phase 4: Permission Function Deployment:** Deploy security-definer helper functions (`is_superadmin()`, `is_admin()`, `has_module_permission()`).
* **Phase 5: RLS Policy Hardening:** Replace prototype policies with strict, granular `FOR SELECT`, `FOR INSERT`, `FOR UPDATE`, and `FOR DELETE` policies.
* **Phase 6: Verification Suite:** Run security test scripts verifying both allowed operations and rejected unauthorized operations.
