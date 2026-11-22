---
trigger: always_on
description: ChurchConnect security rules for repository workflow, Supabase authorization, role/ministry scope, secret handling, and approval gates.
---

# ChurchConnect Security & Authorization Rules

These rules apply unconditionally across ChurchConnect development and agent interactions. `AGENTS.md` contains the repository-wide workflow and documentation requirements.

## 1. Secrets & Credential Management
- Never place database passwords, service-role keys, Supabase secret API keys, HMAC secrets, JWTs, access tokens, refresh tokens, or passwords in frontend code, Git-tracked files, terminal arguments, logs, screenshots, or documentation.
- Browser configuration may use only the intended publishable values such as `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and the public Turnstile site key.
- High-privilege credentials belong only in approved server-side environments such as Supabase Edge Functions.
- Verify `.env*` exclusions in `.gitignore`.

## 2. Database Authorization & RLS
- PostgreSQL grants, RLS policies, constraints, and trusted database operations are the authorization boundary. Frontend route guards, hidden navigation, and disabled buttons are UX controls only.
- Enable RLS on every new sensitive table and create narrow policies per operation. Avoid broad `FOR ALL` policies unless the full read/write behavior is explicitly justified.
- Review SQL privileges and RLS together. A grant does not bypass RLS; a policy does not grant missing table privileges.
- Use `SECURITY DEFINER` only when required. Fix `search_path`, schema-qualify objects, derive caller identity from `auth.uid()`, revoke default PUBLIC execution, grant EXECUTE narrowly, and validate all privileged parameters.
- Never accept a browser-supplied user ID or role as proof of caller identity.
- Do not apply files under `supabase/review/` without explicit owner approval. They are manual review scripts, not automatically applied migrations.

## 3. Canonical Roles, Assignments & Permission Model
Use the exact current role IDs:
- `superadmin`
- `church_council`
- `church_admin`
- `ministry_leader`
- `ministry_volunteer`
- `member`

Keep three concepts separate:
1. System role: the person's church/platform position.
2. Ministry-scoped assignment: the ministry within which a role applies.
3. Module/action permission: the capability to perform an operation.

A ministry-scoped `ministry_leader` or `ministry_volunteer` assignment must never become global Church Admin or Superadmin authority. Do not infer role hierarchy from role names. Role delegation remains blocked until a schema-backed hierarchy and assignment rules are approved.

The proposed `role_module_permissions` / `user_module_permissions` engine is not present in the owner-supplied current schema inventory as of 2026-11-22. Do not assume it exists or implement against it until current schema evidence confirms it.

## 4. Permission Resolution & Default Deny
- Missing or PENDING grants deny access.
- For non-superadmins, an explicit per-user FALSE override denies an otherwise granted action; an explicit TRUE is still subject to authentication, account approval, module activity, record ownership, ministry scope, and all other safeguards.
- Owner-approved rule: an authenticated, approved user with a valid canonical global `superadmin` assignment bypasses ordinary per-user permission overrides (both TRUE and FALSE). This precedence exception does not itself seed or grant every module/action and does not bypass authentication, approval/integrity, record/ministry scope, constraints, audit, or protected-role safeguards.
- Do not seed permissions or translate legacy `permissions` / `role_permissions` rows without explicit owner-approved mapping.

## 5. Superadmin Integrity
- Preserve the canonical `superadmin` role and existing database safeguards. Do not rename, delete, demote, or replace protection functions/triggers without inspecting their current definitions and every mutation path.
- Maintain at least one active, approved global Superadmin. Concurrency protection must cover all relevant ways to invalidate or delete such an account; do not claim full coverage based only on a trigger for one table.
- Never use the real bootstrap Superadmin as a destructive test fixture. Use isolated disposable accounts and independent sessions.

## 6. Ministry Scope
- A role assignment scoped to one ministry authorizes no other ministry.
- Ministry capability checks and row-level ministry scope checks are separate requirements.
- Prefer deactivation over deletion where foreign-key cascades could remove assignments.
- If primary and additional leaders are both supported, keep the primary-leader reference and matching role assignment consistent in one trusted transaction. Additional leaders must not inherit primary-leader-only actions unless separately approved.

## 7. Safe Change Gate
- Inspect the connected GitHub repository before asking the owner to read tracked files manually. Use local commands only for local-only state, runtime tests, or environment verification.
- Inspect the live target schema before any database operation. Verify the exact project ref.
- Never execute destructive SQL, apply review SQL, alter production configuration, merge a PR, deploy an Edge Function, or deploy the frontend without explicit owner approval.
- A merge may trigger the configured Vercel production deployment. Warn before requesting merge approval.
- No new migration or permission seed until the design, rollback, grants, RLS, and test plan are reviewed and approved.
