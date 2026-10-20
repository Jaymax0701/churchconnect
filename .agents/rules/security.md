---
trigger: always_on
description: Core security rules, authorization protocols, secret handling, Row Level Security (RLS) enforcement, and safety gates for destructive operations across ChurchConnect.
---

# ChurchConnect Security & Authorization Rules

These security rules apply unconditionally across all development and agent interactions within ChurchConnect.

## 1. Secrets & Credential Management
* **Zero Secret Exposure:** Never put database passwords, service-role keys, private API keys, or JWT secrets in client-side code, git-tracked files, or terminal command arguments.
* **Environment Separation:**
  * Client-exposed variables must strictly use the `VITE_` prefix (e.g., `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
  * High-privilege tokens (such as Supabase `service_role` key) must never be loaded into the frontend bundle. They are reserved exclusively for secure, server-side execution contexts (e.g., Supabase Edge Functions).
* **Git Hygiene:** Verify that `.env*` files containing secrets or credentials remain excluded in `.gitignore`.

## 2. Server-Side Authorization & RLS
* **The Database is the Sole Authority:** Never rely on frontend routing (`<AdminRoute>`), conditionally hidden buttons, or disabled inputs to enforce security. All access controls must be enforced by PostgreSQL Row Level Security (RLS) policies.
* **Default Deny:** Every new table created in PostgreSQL must immediately execute `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`. By default, no row may be read or written unless an explicit policy permits it.
* **Separate Reads from Writes:** Always specify granular policies per operation (`FOR SELECT`, `FOR INSERT`, `FOR UPDATE`, `FOR DELETE`). Avoid broad `FOR ALL` policies that inadvertently grant write access when only read access was intended.
* **Evaluation Functions:** Complex permission lookups (such as role checks or per-user module grants) must use `SECURITY DEFINER` functions in PostgreSQL to prevent recursive policy evaluations and policy circumvention.

## 3. Dual-Tier Permission Architecture
* **Roles vs. Module CRUD:**
  * System roles (`SUPERADMIN`, `ADMIN`, `MINISTRY_LEADER`, `MEMBER`) define baseline administrative access and hierarchy.
  * Fine-grained module permissions (`user_module_permissions`) provide explicit View, Create, Update, and Delete grants on individual feature modules.
  * Permissions are strictly additive: a user receives the union of their role permissions and any explicit per-user grants.

## 4. SUPERADMIN Protection
* **PostgreSQL-Enforced Invariants:**
  * The `SUPERADMIN` role is marked as `is_system_role = TRUE` and cannot be deleted, renamed, or demoted.
  * A PostgreSQL trigger must block any non-SUPERADMIN user from assigning the `SUPERADMIN` role or modifying a SUPERADMIN user's records.
  * The system must block self-demotion or deletion if only one active `SUPERADMIN` remains in the database.

## 5. Destructive Operation Safety Gate
* **Stop and Verify:** Never execute destructive SQL statements (`DROP TABLE`, `TRUNCATE`, bulk `DELETE` without precise `WHERE` clauses) or modify existing production tables without explicit, documented user confirmation.
* **No Unplanned Migrations:** Do not generate or run SQL migrations until schema designs have been reviewed and approved.
