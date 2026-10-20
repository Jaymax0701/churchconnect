---
trigger: model_decision
description: Use this rule when designing, inspecting, or writing PostgreSQL schemas, Supabase migrations, table constraints, indexes, foreign keys, or Row Level Security (RLS) policies.
---

# ChurchConnect Database & Migration Rules

These rules govern all database design, SQL execution, and schema management for ChurchConnect.

## 1. Schema Inspection & Migration Discipline
* **Inspect Before Proposing:** Always inspect existing database tables, triggers, and migration files before proposing or writing schema changes.
* **Version-Controlled Changes:** All schema changes must be documented in sequential, numbered SQL migration files (e.g., `supabase/migrations/0001_initial_schema.sql`). Never apply ad-hoc, untracked changes directly in production.
* **Rollback Considerations:** Every migration plan must consider rollback implications. Document whether changes can be reversed cleanly (e.g., dropping newly added columns or tables) without data corruption.

## 2. Relational Integrity & Schema Design
* **Supabase Auth Integration:** Never duplicate `auth.users` in a custom `users` table. The primary user profile table is `public.profiles`, where `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`.
* **Foreign Key Constraints:** All inter-table relationships must use explicit foreign keys with defined deletion behaviors (`ON DELETE CASCADE` or `ON DELETE SET NULL`) to maintain referential integrity.
* **Data Constraints:** Enforce data validity at the database level using `NOT NULL`, `UNIQUE`, and `CHECK` constraints (e.g., ensuring event end times are strictly after start times).
* **Indexing Strategy:** Create explicit indexes on all foreign keys, high-frequency lookup columns (`email`, `user_id`, `status`), and timestamp ranges used in calendar queries.

## 3. Row Level Security (RLS) Enforcement
* **Mandatory RLS:** Every table in the `public` schema must execute `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`.
* **Granular Policy Definition:** Define separate policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. Avoid blanket `FOR ALL` policies.
* **Helper Functions:** Use optimized PostgreSQL functions (e.g., `is_superadmin()`, `has_module_permission()`) marked with `SECURITY DEFINER` and `SET search_path = public` to evaluate authorization logic safely without triggering infinite RLS loops.

## 4. Verification Protocol
* **Test Both Access Paths:** Whenever a migration introduces or modifies an RLS policy, verify both allowed access (authorized user can read/write) and denied access (unauthenticated user or unauthorized role is blocked).
* **Safe Staging:** Develop and test SQL statements in local or non-destructive staging environments before recommending deployment to production databases.
