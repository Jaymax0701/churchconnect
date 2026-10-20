# ChurchConnect — Security & Authorization Architecture (Milestone 2)

This document establishes the precise operational rules, precedence engine, function-hardening standards, and concurrency guarantees governing authorization in ChurchConnect.

---

## 1. The Nine Rules of the Permission Engine

The ChurchConnect authorization engine operates under nine strict, non-negotiable rules enforced at the PostgreSQL database layer:

1. **Role Baseline:** Role-module permissions (`role_module_permissions`) define the baseline CRUD grants (`can_view`, `can_create`, `can_update`, `can_delete`) for each system role.
2. **User Override Precedence:** An explicit per-user permission record (`user_module_permissions`) strictly takes precedence over any role-derived baseline.
3. **Explicit Grant Precondition:** An explicit user grant (`can_<action> = TRUE`) authorizes the action *only* when all applicable authentication, account approval, and record-scoping requirements are satisfied.
4. **Explicit Denial Primacy:** An explicit user denial (`can_<action> = FALSE`) strictly denies the action even if one or more of the user's assigned roles would otherwise permit it.
5. **Default Deny:** If neither an explicit user grant nor an applicable role grant exists, access is denied by default.
6. **No Scope or Integrity Bypass:** Permission checks do not bypass authentication, member account approval (`is_approved = TRUE`), ministry-scope boundaries, record ownership, or database constraints.
7. **Database is Sole Authority:** All access boundaries are enforced server-side via PostgreSQL Row Level Security (RLS) policies and security-definer functions. Frontend navigation checks and conditional button rendering are user-experience conveniences only.
8. **Anti-Escalation & Self-Approval Guard:** Users cannot grant themselves roles, approve their own accounts, or alter their own protected privilege fields.
9. **Hierarchical Administration:** Only authorized administrators can assign roles or configure permissions, strictly constrained by role hierarchy (`roles.hierarchy_level`) and immutable system role definitions.

---

## 2. Evaluation Logic & Precedence Hierarchy

### A. Precedence Flowchart

```
┌────────────────────────────────────────────────────────┐
│ Step 1: Is user authenticated and active?              │
│ ├─ NO  ──► Public Access Only (is_public = TRUE)       │
│ └─ YES ──► Proceed to Step 2                           │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Step 2: Is user account approved (is_approved = TRUE)? │
│ ├─ NO  ──► Blocked from all protected features         │
│ │          (Self profile only; no directory/rosters)   │
│ └─ YES ──► Proceed to Step 3                           │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Step 3: Is user an active SUPERADMIN?                  │
│ ├─ YES ──► ALLOW (Global administrative authority)     │
│ └─ NO  ──► Proceed to Step 4                           │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Step 4: Check explicit 'user_module_permissions'       │
│ ├─ can_<action> = FALSE  ──► DENY (Explicit Override)  │
│ ├─ can_<action> = TRUE   ──► Proceed to Scope Check    │
│ └─ NULL / No Record      ──► Proceed to Step 5         │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Step 5: Check 'role_module_permissions' for all roles  │
│ ├─ Union across all user roles grants action ──► Scope │
│ └─ No assigned role grants action      ──► Proceed 6   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Step 6: Default Deny Gate                              │
│ └─ Neither explicit nor role grant exists ──► DENY     │
└────────────────────────────────────────────────────────┘
```

### B. Deterministic Resolution Rules

1. **Role Grants vs. Explicit Per-User Overrides:**
   * Role-module permissions (`role_module_permissions`) establish the default baseline for a given role.
   * Explicit per-user permissions (`user_module_permissions`) supersede any role-derived baseline.
2. **Explicit Denial Primacy:**
   * If `user_module_permissions.can_<action> = FALSE`, access is **strictly denied**, regardless of how many roles or how elevated the user's roles are. An explicit denial cannot be overridden by an administrative role assignment.
3. **Multiple Role Assignment Resolution:**
   * When a user holds multiple roles (e.g., `MINISTRY_LEADER` and `CHURCH_COUNCIL`), baseline role permissions are combined using an **additive logical OR (`bool_or`)**. If *any* active assigned role grants `can_<action> = TRUE`, the role baseline evaluates to `TRUE`.
   * However, if an explicit per-user denial (`FALSE`) exists for that module and action, it immediately overrides the union of all roles.
4. **Scope & Ministry Isolation Across Multi-Role Assignments:**
   * **Module Permission vs. Record Scope:** A module permission grant (e.g., `events.can_update = TRUE`) grants the *capability* to update events, but table-level RLS policies strictly evaluate *record scope*.
   * **Multi-Role Scoping Invariant:** Holding `MINISTRY_LEADER` for Ministry A (e.g., Youth) and `VOLUNTEER` for Ministry B (e.g., Worship) does **not** grant leadership privileges over Ministry B. RLS policies evaluate `events.ministry_id IN (SELECT id FROM public.ministries WHERE leader_id = auth.uid()) OR public.is_admin()`. An elevated role in one scope never bleeds into another scope.
5. **Account Approval & Inactive Users:**
   * **Unapproved Account Gate:** If `profiles.is_approved = FALSE`, the user is strictly barred from all internal congregation features (member directory, cell groups, internal rosters), even if they have been assigned an administrative role or an explicit user grant.
   * **Inactive / Deleted Users:** When a user is unauthenticated (`auth.uid() IS NULL`) or deleted from `auth.users`, all permission checks immediately return `FALSE`. Only records with `is_public = TRUE` can be viewed.
   * **Inactive Modules / Ministries:** If `modules.is_active = FALSE` or `ministries.is_active = FALSE`, non-SUPERADMIN access to those entities is disabled.
6. **Record Ownership Invariants:**
   * For user-scoped records (personal profile, roster notes), users may only view or update records where `id = auth.uid()` or `created_by = auth.uid()`, unless the actor possesses elevated administrative module permissions (`portal.can_update = TRUE` with `ADMIN` or `SUPERADMIN`).
7. **Missing Grants & Default Deny:**
   * If no explicit user override exists and no assigned role grants the action, the evaluation strictly defaults to **DENY**.
8. **Legacy Permission Coexistence & Cutover (DEC-002):**
   * Legacy tables `permissions` and `role_permissions` remain intact for audit history and backward compatibility.
   * The single authoritative permission engine (`has_module_permission()`) inspects only `user_module_permissions` and `role_module_permissions`.
   * Legacy tables are **never** queried independently during live authorization checks, guaranteeing that legacy role records cannot bypass explicit user denials.
   * Any custom historical mappings in `role_permissions` will be migrated into `role_module_permissions` via an audited pre-cutover script.

---

## 3. Function-by-Function Security Review (`SECURITY DEFINER` vs. `SECURITY INVOKER`)

`SECURITY DEFINER` functions run with the privileges of their owning role (`postgres`). They must be employed solely where necessary to prevent recursive RLS evaluations or cross-table privilege boundaries. All other functions must remain ordinary `SECURITY INVOKER` functions.

### A. Helper Functions Requiring `SECURITY DEFINER`

| Function Signature | Primary Objective | Justification for `SECURITY DEFINER` | Search Path & Ownership | Execution Grants | Caller Identity Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.is_superadmin()` | Fast check if current caller is an active SUPERADMIN | `public.user_roles` has RLS enabled (non-admins cannot read other assignments). Calling this inside RLS policies requires reading `user_roles` without triggering circular RLS. | Owner: `postgres`<br>`SET search_path = public, pg_temp;` | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO authenticated, anon;` | Evaluates strictly against `auth.uid()`. Accepts no caller-supplied user parameter. |
| `public.is_approved_member()` | Check if current caller has approved status | `public.profiles` has RLS restricting directory queries. RLS policies evaluating approval must read `profiles.is_approved` without triggering recursive policy checks on `profiles`. | Owner: `postgres`<br>`SET search_path = public, pg_temp;` | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO authenticated, anon;` | Evaluates strictly against `auth.uid()`. Accepts no caller-supplied user parameter. |
| `public.has_module_permission(p_module TEXT, p_action TEXT)` | Authoritative permission engine for module CRUD checks | Reads `user_module_permissions`, `role_module_permissions`, and `user_roles`. Standard members cannot read administrative matrix tables directly. Prevents infinite RLS recursion in policies. | Owner: `postgres`<br>`SET search_path = public, pg_temp;` | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO authenticated;` | Evaluates strictly against `auth.uid()`. Prohibits caller impersonation. Parameterized queries only (no dynamic SQL). |
| `public.guard_last_superadmin_trigger()` | Concurrency trigger protecting the last active SUPERADMIN | Must acquire exclusive row lock on `public.roles` and count remaining SUPERADMINs across `public.user_roles` regardless of caller's table privileges. | Owner: `postgres`<br>`SET search_path = public, pg_temp;` | Trigger function; executed via database trigger on `user_roles` and `profiles`. | Verifies caller authorization (`is_superadmin()`) before permitting changes to SUPERADMIN rows. |
| `public.protect_profile_approval_trigger()` | Prevent member self-approval | Must check whether caller has administrative authority before allowing updates to `is_approved` or `approval_date`. | Owner: `postgres`<br>`SET search_path = public, pg_temp;` | Trigger function; executed via database trigger on `profiles`. | Compares `NEW.is_approved` with `OLD.is_approved`. If altered by a non-admin, raises exception. |

### B. Functions That Must Remain `SECURITY INVOKER`
* Domain query functions (e.g. event search, sermon filtering, roster lookups) where caller's existing RLS policies should naturally apply.
* Date and timestamp validation utilities (e.g. `check_event_times()`).
* String formatting, sanitization, and slug generation functions.
* Client-callable RPC endpoints that perform user-scoped data writes, ensuring that table-level RLS policies are actively enforced.

### C. The 7-Point Security-Definer Hardening Checklist
* [ ] **1. Restricted Owner:** Owned strictly by `postgres`.
* [ ] **2. Explicit Search Path:** Every function contains `SET search_path = public, pg_temp;`.
* [ ] **3. Strict Schema Qualification:** All table and relation names prefixed with `public.` (e.g., `public.user_roles`).
* [ ] **4. Execution Revocation:** Default `PUBLIC` execution revoked immediately upon creation.
* [ ] **5. Identity Grounded in `auth.uid()`:** Helper functions for RLS do not accept caller-supplied user IDs. They read `auth.uid()` directly. Administrative functions inspecting other users must verify `public.is_admin()` first.
* [ ] **6. No Dynamic SQL:** All queries use parameterized static SQL (`SELECT ... WHERE ...`); dynamic SQL (`EXECUTE format(...)`) is strictly prohibited.
* [ ] **7. Table Grants Separation:** Execution granted only to roles that genuinely require it (`authenticated`, `anon`).

---

## 4. Transactional, Concurrency-Safe Last-SUPERADMIN Protection

### A. The Concurrency Flaw of Naive Count Checks
In an active multi-admin system, two administrators may simultaneously attempt to demote themselves, or two concurrent sessions might process conflicting administrative mutations. Under a naive `SELECT count(*) FROM user_roles WHERE role_id = 'SUPERADMIN'` check:
* **Session 1 (Demoting Alice):** Reads count = 2. Evaluates 2 - 1 >= 1 (passes).
* **Session 2 (Demoting Bob):** Simultaneously reads count = 2. Evaluates 2 - 1 >= 1 (passes).
* Both transactions execute their `DELETE` or `UPDATE` statements and commit.
* **Result:** The system is left with **zero** active superadmins, causing an irreversible administrative lockout.

### B. Supported Role Mutation Paths & Synchronization Barrier
Every database mutation that could diminish or affect the active SUPERADMIN count must participate in the exact same synchronization mechanism:

1. **Path 1: Demoting a SUPERADMIN via `public.user_roles`:**
   * Action: `DELETE FROM public.user_roles WHERE role_id = 'SUPERADMIN'` or `UPDATE public.user_roles SET role_id != 'SUPERADMIN'`.
   * Synchronization: `BEFORE UPDATE OR DELETE ON public.user_roles` trigger fires, acquires exclusive lock:
     `PERFORM 1 FROM public.roles WHERE id = 'SUPERADMIN' FOR UPDATE;`
   * Re-counts active superadmins. If remaining < 1, raises exception `P0001`.
2. **Path 2: Deleting a SUPERADMIN profile via `public.profiles`:**
   * Action: `DELETE FROM public.profiles WHERE id = superadmin_id`.
   * Synchronization: `BEFORE DELETE ON public.profiles` checks if target is a SUPERADMIN. If yes, acquires `roles WHERE id = 'SUPERADMIN' FOR UPDATE`, counts remaining superadmins, and raises `P0001` if remaining < 1.
3. **Path 3: Deactivating a SUPERADMIN profile via `public.profiles`:**
   * Action: `UPDATE public.profiles SET is_approved = FALSE WHERE id = superadmin_id`.
   * Synchronization: `BEFORE UPDATE ON public.profiles` checks if target is a SUPERADMIN and `NEW.is_approved = FALSE`. If yes, acquires the lock, verifies remaining approved superadmins >= 1, and raises `P0001` if remaining < 1.
4. **Path 4: Cascading Deletion from `auth.users`:**
   * Action: Deletion of a user in `auth.users` cascades to `public.profiles` (`ON DELETE CASCADE`), which cascades to `public.user_roles`.
   * Synchronization: PostgreSQL executes foreign key cascades within the same transaction and fires `BEFORE DELETE` triggers. The trigger acquires the lock and aborts the deletion if it is the last active SUPERADMIN.
5. **Path 5: Concurrent Promotion and Demotion:**
   * Action: Transaction 1 promotes Carol to SUPERADMIN (`INSERT INTO user_roles ...`), while Transaction 2 demotes Bob.
   * Synchronization: Promotions to `SUPERADMIN` (`INSERT INTO user_roles (role_id = 'SUPERADMIN')`) also acquire the lock on `public.roles WHERE id = 'SUPERADMIN' FOR UPDATE`. This ensures that promotions and demotions serialize cleanly against one another, eliminating race conditions between additions and removals.
6. **Path 6: Authorization Failures:**
   * Action: Non-superadmin attempts to modify a SUPERADMIN role or user assignment.
   * Synchronization: The trigger checks `IF NOT public.is_superadmin() THEN RAISE EXCEPTION ...; END IF;` *before* proceeding, immediately aborting unauthorized mutations.

### C. Lock Ordering & Deadlock Prevention
* **Global Lock Anchor:** `public.roles WHERE id = 'SUPERADMIN'` is the single, consistent lock anchor.
* **Deterministic Order:** Every trigger interacting with SUPERADMIN assignments acquires this row lock *first*, before performing any reads or modifying child records.
* Because all transactions acquire the lock on the exact same row in the same order, cycles are impossible and deadlocks cannot occur. Transactions serialize in a clean FIFO queue.

### D. Implementation Blueprint `[PROPOSED]`
```sql
-- Proposed trigger function for user_roles and profiles mutations
CREATE OR REPLACE FUNCTION public.guard_last_superadmin_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining INT;
  v_target_user UUID;
BEGIN
  -- Determine target user based on operation
  IF TG_TABLE_NAME = 'user_roles' THEN
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.role_id = 'SUPERADMIN' THEN
      v_target_user := OLD.user_id;
    ELSIF TG_OP = 'INSERT' AND NEW.role_id = 'SUPERADMIN' THEN
      -- Serialize promotions on the same anchor
      PERFORM 1 FROM public.roles WHERE id = 'SUPERADMIN' FOR UPDATE;
      RETURN NEW;
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    -- Check if affected profile has SUPERADMIN role
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.id AND role_id = 'SUPERADMIN') THEN
      v_target_user := OLD.id;
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  -- 1. Authorization check: caller must be an active SUPERADMIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Authorization Failure: Only an active SUPERADMIN can alter SUPERADMIN assignments.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Acquire exclusive lock on the synchronization anchor
  PERFORM 1 FROM public.roles WHERE id = 'SUPERADMIN' FOR UPDATE;

  -- 3. Calculate remaining active approved SUPERADMINs
  SELECT count(*) INTO v_remaining
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role_id = 'SUPERADMIN'
    AND p.is_approved = TRUE
    AND ur.user_id != v_target_user;

  -- 4. Enforce invariant: at least 1 active SUPERADMIN must remain
  IF v_remaining < 1 THEN
    RAISE EXCEPTION 'Safety Violation: Cannot remove or demote the sole remaining active SUPERADMIN.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
```

### E. Two-Session Concurrency Verification Test Protocol
To be validated in an isolated staging environment during Milestone 2D:

* **Setup:** Seed exactly two active approved SUPERADMINs (`alice_id` and `bob_id`).
* **Session 1 (Admin 1 Demotion):**
  ```sql
  BEGIN;
  DELETE FROM public.user_roles WHERE user_id = 'alice_id' AND role_id = 'SUPERADMIN';
  -- Session 1 acquires lock on roles row, count remains 1 (Bob), passes check
  SELECT pg_sleep(3); -- Hold lock to force Session 2 into wait state
  COMMIT;
  ```
* **Session 2 (Simultaneous Admin 2 Demotion):**
  ```sql
  BEGIN;
  DELETE FROM public.user_roles WHERE user_id = 'bob_id' AND role_id = 'SUPERADMIN';
  -- Session 2 blocks waiting for Session 1 to release the lock on 'SUPERADMIN' row
  -- Once Session 1 commits, Session 2 acquires lock, re-reads count: remaining = 0!
  -- Session 2 raises exception P0001 and transaction rolls back
  COMMIT;
  ```
* **Expected Outcome:** Session 1 succeeds (commits). Session 2 throws exception `P0001`. Final database state: Bob remains an active approved SUPERADMIN.
* **Status:** **[PROPOSED SPECIFICATION]** (Must be empirically verified in staging before production release).

---

## 5. Scope & Record-Level Ownership Rules

Permission to perform an action on a module does not grant unrestricted access to every record in that module:

| Module | Role / Context | Ownership & Scope Enforcement Rule |
| :--- | :--- | :--- |
| `portal` | `MEMBER` | Member can only read and update their personal profile (`profiles.id = auth.uid()`). |
| `ministry` | `MINISTRY_LEADER` | Leader can only manage rosters and team members for ministries where `ministries.leader_id = auth.uid()`. |
| `events` | `MINISTRY_LEADER` | Leader can only update events where `events.ministry_id` is under their direct leadership (`ministries.leader_id = auth.uid()`). Multi-ministry leaders only manage their specific assigned ministries. |
| `registration`| `CHURCH_ADMIN` | Admin can approve members (`is_approved = TRUE`), but cannot demote, debar, or modify `SUPERADMIN` profiles. |
| `cms` | `CHURCH_ADMIN` | Admin can publish public announcements and update service times. |
| All Modules | `SUPERADMIN` | System-wide administrative scope, constrained by database relational integrity and audit triggers. |
