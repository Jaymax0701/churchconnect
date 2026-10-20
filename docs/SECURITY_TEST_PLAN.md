# ChurchConnect — Milestone 2B: Security Verification & Test Plan

**Document Status:** Planning-Only (Test Specification Blueprint)  
**Execution Authority:** **No execution authorized in Milestone 2B.** All tests documented below are designed for execution in Milestone 2C within an isolated staging environment.  
**Objective:** Provide rigorous, empirical validation of the dual-tier authorization engine, RLS policy enforcement, anti-escalation safeguards, and concurrent last-SUPERADMIN protections.

---

## 1. Test Classification & Severity Definitions

* **CRITICAL:** Total security failure (e.g., privilege escalation, member self-approval, loss of all SUPERADMINs, direct bypass of RLS). Must immediately block deployment.
* **HIGH:** Authorization breach within a module or failure of an explicit denial override. Blocks deployment.
* **MEDIUM:** Flaw in metadata representation, logging omission, or UX permission mismatch without data leakage.

Every test specifies:
`Test ID` | `Scenario` | `Preconditions` | `Action` | `Expected Result` | `Severity` | `Evidence Required` | `Execution Target`

---

## 2. Security Test Matrix

### A. Member Registration & Approval Gate (DEC-001)

| Test ID | Scenario | Preconditions | Action | Expected Result | Severity | Evidence Required | Execution Target |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **REG-01** | Anonymous visitor accesses public pages | None (Unauthenticated) | HTTP GET `/`, `/events`, `/sermons` | Status 200; public content visible. | MEDIUM | HTTP 200 response | Browser / API |
| **REG-02** | New user sign-up creates unapproved profile | Valid email/password | Call `supabase.auth.signUp()` | Profile created with `is_approved = FALSE`, role `MEMBER`. | **CRITICAL** | Profile row with `is_approved=false` | Staging DB |
| **REG-03** | Unapproved user queries member directory | Authenticated as unapproved user | `supabase.from('profiles').select('*')` | Only actor's personal row returned. Zero other members visible. | **CRITICAL** | Result set length = 1 | Staging API |
| **REG-04** | Member attempts self-approval via direct API | Authenticated member | `supabase.from('profiles').update({ is_approved: true }).eq('id', auth.uid())` | Blocked with PostgreSQL error (42501 or trigger exception). | **CRITICAL** | Error response; `is_approved` remains FALSE | Staging API |
| **REG-05** | Authorized Admin approves pending member | Authenticated as `ADMIN` | `supabase.from('profiles').update({ is_approved: true, approval_date: now() }).eq('id', target_id)` | Status 200; `is_approved` becomes TRUE. Target user now sees directory. | **HIGH** | Updated row; directory accessible | Staging API |

---

### B. Authentication, Data Isolation & RLS

| Test ID | Scenario | Preconditions | Action | Expected Result | Severity | Evidence Required | Execution Target |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **RLS-01** | Anonymous write probe to protected tables | Anonymous (no token) | `INSERT INTO profiles (id, full_name) VALUES (...)` | PostgreSQL error `42501` (violates RLS). | **CRITICAL** | HTTP 401/403 with code 42501 | Staging API |
| **RLS-02** | Authenticated user reads personal profile | Authenticated user | `supabase.from('profiles').select('*').eq('id', auth.uid())` | Actor's own profile returned with all personal attributes. | **HIGH** | Exact row match | Staging API |
| **RLS-03** | User attempts to update another member's profile | User A authenticated | `supabase.from('profiles').update({ full_name: 'Hacked' }).eq('id', user_b_id)` | Update affects 0 rows; no data modified. | **CRITICAL** | Rows affected = 0; User B unchanged | Staging API |
| **RLS-04** | Direct API mutation bypassing frontend hidden buttons | Member authenticated | Issue direct PostgREST `POST /rest/v1/events` | Blocked with 42501. Frontend concealment verified as not security control. | **CRITICAL** | HTTP 403 error code 42501 | Staging API |
| **RLS-05** | Policy evaluation immunity from recursive loops | Authenticated user | Query tables with role-checking policies | Query executes in < 50ms without recursive loop error. | **HIGH** | Query execution time; no 500 error | Staging API |

---

### C. Permission Precedence & Hybrid Matrix Engine

| Test ID | Scenario | Preconditions | Action | Expected Result | Severity | Evidence Required | Execution Target |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **PRC-01** | Baseline role grant with no user override | User has `ADMIN` role (`events.can_create = TRUE`) | `supabase.from('events').insert({ title: 'New Service', ... })` | Allowed; event inserted successfully. | **HIGH** | Created event row in database | Staging API |
| **PRC-02** | Explicit user grant without role baseline | User is `MEMBER` (`cms.can_create = FALSE`); `user_module_permissions.can_create = TRUE` | Insert new announcement via `cms` module | Allowed; personal grant elevates specific capability. | **HIGH** | Created row in announcements | Staging API |
| **PRC-03** | **Explicit user denial overrides role grant** | User has `ADMIN` role; `user_module_permissions.can_delete = FALSE` on `events` | `supabase.from('events').delete().eq('id', event_id)` | **BLOCKED:** Explicit denial takes precedence over `ADMIN` role grant. | **CRITICAL** | Deletion blocked with 42501 error | Staging API |
| **PRC-04** | Default deny when no grant exists | User is `MEMBER` (no grant for `ministries.can_update`) | Update ministry record | Blocked by default deny rule. | **HIGH** | Rows affected = 0 or 42501 | Staging API |
| **PRC-05** | Multiple conflicting roles evaluation | User has `LEADER` (grants view) and `VOLUNTEER` (no view) | Query module records | Allowed via additive union of roles. | **HIGH** | Rows returned | Staging API |
| **PRC-06** | Multiple roles with explicit personal denial | User has `LEADER` + `COUNCIL`; explicit `can_update = FALSE` | Attempt update on target module | **BLOCKED:** User denial overrides the union of all roles. | **CRITICAL** | Update rejected | Staging API | **PRC-07** | Ministry Leader record-scoping violation | Worship Leader attempts editing A/V Tech event | Update event where `ministry_id != worship_id` | Blocked by record-level ministry ownership check. | **HIGH** | RLS blocks non-owned ministry | Staging API |
| **PRC-08** | Unapproved account with role assignment | User assigned `ADMIN` in `user_roles`, but `profiles.is_approved = FALSE` | Query member directory or access CMS | **BLOCKED:** Unapproved account gate strictly blocks access to protected congregation data regardless of role. | **CRITICAL** | Request blocked with 42501 | Staging API |

---

### D. Privilege Escalation & Role Assignment Safety

| Test ID | Scenario | Preconditions | Action | Expected Result | Severity | Evidence Required | Execution Target |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ESC-01** | Member attempts self-assignment of `ADMIN` role | Authenticated `MEMBER` | `supabase.from('user_roles').insert({ user_id: auth.uid(), role_id: 'ADMIN' })` | Blocked with PostgreSQL 42501. | **CRITICAL** | Blocked write; zero role changes | Staging API |
| **ESC-02** | Church Admin attempts granting `SUPERADMIN` role | Authenticated `ADMIN` (level 20) | Assign `role_id = 'SUPERADMIN'` to peer | Blocked by trigger: only SUPERADMIN can grant SUPERADMIN. | **CRITICAL** | Trigger exception raised | Staging API |
| **ESC-03** | Unauthorized direct write to `role_module_permissions` | Non-superadmin | `UPDATE role_module_permissions SET can_delete = true` | Blocked with 42501. | **CRITICAL** | Permission matrix unchanged | Staging API |
| **ESC-04** | Attempt to rename or drop a system role | Non-superadmin | `DELETE FROM roles WHERE id = 'SUPERADMIN'` | Blocked by `is_system_role` immutability trigger. | **CRITICAL** | Error: System roles cannot be deleted | Staging API |
| **ESC-05** | Direct unauthorized write probe to legacy permission tables | Non-superadmin | `INSERT INTO role_permissions (role_id, permission_id) VALUES (...)` | Blocked with 42501. Legacy tables protected from tampering. | **CRITICAL** | Write rejected | Staging API |

---

### E. Concurrency-Safe SUPERADMIN Safeguards

| Test ID | Scenario | Preconditions | Action | Expected Result | Severity | Evidence Required | Execution Target |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SUP-01** | Demote sole remaining SUPERADMIN (Single-Session) | Exactly 1 SUPERADMIN exists | `DELETE FROM user_roles WHERE role_id = 'SUPERADMIN'` | Blocked by trigger: Cannot remove sole remaining SUPERADMIN. | **CRITICAL** | Trigger exception `P0001` | Staging DB |
| **SUP-02** | **Two-Session Concurrent Demotion Race Test** | Exactly 2 SUPERADMINs exist (Admin 1, Admin 2) | Simultaneous demotions in two separate DB sessions | Session 1 succeeds (leaves 1); Session 2 is serialized on lock, re-checks count, and **aborts with P0001**. Exactly 1 SUPERADMIN remains. | **CRITICAL** | Exactly 1 SUPERADMIN verified post-test; Session 2 error logged | Multi-Session Staging DB |
| **SUP-03** | Deletion of SUPERADMIN user profile | Target user is sole SUPERADMIN | `DELETE FROM profiles WHERE id = superadmin_id` | Blocked by cascade protection trigger. | **CRITICAL** | Profile deletion rejected | Staging DB |
| **SUP-04** | SUPERADMIN demotion via account deactivation | Target user is sole SUPERADMIN | `UPDATE profiles SET is_approved = false WHERE id = ...` | Blocked by safety trigger. | **CRITICAL** | Deactivation rejected | Staging DB |
| **SUP-05** | **Concurrent Promotion and Demotion Race Test** | Exactly 1 SUPERADMIN exists (Admin 1) | Session 1 promotes Admin 2; Session 2 simultaneously demotes Admin 1 | Both serialize on `roles WHERE id = 'SUPERADMIN' FOR UPDATE`. Either promotion succeeds first, allowing demotion, OR demotion fails first. System state remains strictly consistent with >= 1 SUPERADMIN. | **CRITICAL** | Database state maintains >= 1 active SUPERADMIN | Multi-Session Staging DB |

---

### F. Data Safety, Reversibility & Release Readiness

| Test ID | Scenario | Preconditions | Action | Expected Result | Severity | Evidence Required | Execution Target |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SAF-01** | Migration dry-run on verified backup | Fresh backup dump | Restore dump into staging; execute migration script | Migration completes in single transaction with 0 errors. | **CRITICAL** | Migration log; exit code 0 | Staging DB |
| **SAF-02** | Preservation of existing rows and FKs | Existing prototype rows in `profiles`, `roles` | Run migration script | All pre-existing rows remain intact with existing PKs. | **CRITICAL** | Pre/post row count match | Staging DB |
| **SAF-03** | Migration idempotency test | Migration script applied | Re-run identical migration script a second time | Script executes cleanly without "already exists" errors. | **HIGH** | Zero errors on duplicate run | Staging DB |
| **SAF-04** | Rollback script execution | Migration script applied | Execute paired `rollback_0001.sql` script | Schema returns cleanly to pre-migration state. | **HIGH** | Schema comparison matches Phase 1 | Staging DB |
| **SAF-05** | Production credential verification | Deployment configuration | Verify `VITE_SUPABASE_URL` and anon key present | Zero secret keys (`service_role`) leaked in client bundle. | **CRITICAL** | Bundle inspection clean | Build Check |
| **SAF-06** | Post-deployment smoke test suite | Migration applied to target | Run automated verification of anonymous landing page, member auth, and admin portal loading | Status 200 on public endpoints; RLS blocks unauthenticated access to member endpoints. | **HIGH** | HTTP 200 on public; HTTP 401 on private | Staging API |

---

## 3. Concurrency Test Execution Protocols (Staging Execution)

### Protocol 1: SUP-02 (Two-Session Concurrent Demotion Guard)

```sql
-- SESSION 1 (Admin 1 Demotion)
BEGIN;
DELETE FROM public.user_roles 
WHERE user_id = '00000000-0000-0000-0000-000000000001' AND role_id = 'SUPERADMIN';
SELECT pg_sleep(3); -- Hold lock to force Session 2 to queue
COMMIT;

-- SESSION 2 (Simultaneous Admin 2 Demotion)
BEGIN;
DELETE FROM public.user_roles 
WHERE user_id = '00000000-0000-0000-0000-000000000002' AND role_id = 'SUPERADMIN';
-- Once Session 1 commits, Session 2 evaluates remaining count = 0 -> RAISES EXCEPTION P0001
COMMIT;
```

* **Pass Criteria:** Session 1 commits. Session 2 throws exception `P0001: Cannot remove sole remaining active SUPERADMIN`. Post-test check verifies `count(*) = 1` for `role_id = 'SUPERADMIN'`.

### Protocol 2: SUP-05 (Concurrent Promotion and Demotion Serialization)

```sql
-- Initial State: Admin 1 is the ONLY active SUPERADMIN. Admin 2 is a MEMBER.

-- SESSION 1 (Simultaneous Promotion of Admin 2)
BEGIN;
INSERT INTO public.user_roles (user_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000002', 'SUPERADMIN');
SELECT pg_sleep(2);
COMMIT;

-- SESSION 2 (Simultaneous Demotion of Admin 1)
BEGIN;
DELETE FROM public.user_roles 
WHERE user_id = '00000000-0000-0000-0000-000000000001' AND role_id = 'SUPERADMIN';
COMMIT;
```

* **Pass Criteria:** Both sessions serialize on `public.roles WHERE id = 'SUPERADMIN' FOR UPDATE`. Regardless of execution order, at least one active approved SUPERADMIN remains at every moment, and the final state has >= 1 active SUPERADMIN.`.
