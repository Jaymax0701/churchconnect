# ChurchConnect Application Authorization Inventory

Status: Repository inspection only. No application, database, or production changes were made by this inventory.

Inspection date: 2026-10-28
Repository branch inspected: `main` after merge of authorization review PR #2
Scope: tracked source tree, route configuration, Supabase client initialization, public-home page, member portal, admin dashboard, and current authorization design documents.

## 1. Findings

### APP-AUTH-01 — No real login/session flow is implemented

`src/modules/auth/pages/LoginPage.tsx` uses a client-side timeout and displays a demonstration message. It does not call `supabase.auth.signInWithPassword`, establish a real session, or handle authentication errors from Supabase.

`src/App.tsx` calls `supabase.auth.getSession()` only to display a connection diagnostic. It does not use the session to protect routes.

**Implication:** a successful-looking login is not evidence of authentication. Implement real sign-in/sign-out/session restoration and error handling before end-to-end authorization tests.

### APP-AUTH-02 — Member and admin routes have no route guard

`src/routes/AppRoutes.tsx` mounts `/portal` and `/admin` directly under their layouts. The inspected route file contains no authentication, approval, role, or permission guard.

**Implication:** these pages are reachable as client-side previews. Route guards are useful for UX but must not replace database RLS and server-side authorization.

### APP-AUTH-03 — The inspected UI pages are demo-only, not database-backed workflows

- `PublicHomePage.tsx` renders static marketing copy and service-time/location placeholders; the inspected component makes no Supabase data query.
- `MemberPortalPage.tsx` displays hard-coded demo identity, roster, cell-group, and profile content; its actions update local React state or show a demo notice.
- `AdminDashboardPage.tsx` displays hard-coded metrics and an in-memory permission matrix; toggles do not write to Supabase.

**Implication:** there is no current public-home database query in these inspected pages that requires an anonymous database read grant. Do not add broad `anon` SELECT privileges merely to support the current static homepage. When public content becomes database-backed, inventory each query and exposed column first.

### APP-AUTH-04 — Admin UI module identifiers diverge from the canonical database inventory

The inspected `AdminDashboardPage.tsx` defines demo modules `registration`, `ministry`, and `mainpage_cms`. The verified staging inventory instead uses canonical module IDs such as `member_portal`, `congregation`, `cms`, and ministry-specific IDs. `registration` and `ministry` are not canonical IDs in the verified 12-module staging inventory.

**Implication:** do not persist the current demo matrix or translate these identifiers implicitly. Replace it with canonical IDs only after the owner-approved permission matrix is finalized.

### APP-AUTH-05 — Server-side/service-role workflow inventory is incomplete

The inspected tracked source tree includes a browser Supabase client in `src/lib/supabase.ts` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The inspected tree did not reveal a tracked server/API route or Supabase Edge Function directory. This is a repository observation, not proof that no external server, dashboard workflow, scheduled job, or out-of-repository integration exists.

**Implication:** before applying the foundation draft's service-role revokes, confirm with the owner whether any external server or Supabase Edge Function uses service-role credentials or direct table access. Never put a service-role secret in `VITE_*` variables or browser code.

## 2. Safe implementation order

1. Keep `supabase/drafts/0004_authorization_foundation.staging.sql` unapplied until its privilege effects and backup/restore path have been reviewed.
2. Approve permission precedence, the role/module/action matrix, special `manage`/`approve`/`assign` capabilities, and ministry appointment rules.
3. Implement real Supabase Auth session handling and protected-route UX; do not treat client checks as the security boundary.
4. Inventory any external/server-side administrative workflows and design narrow, auditable trusted operations before deciding service-role grants.
5. Keep public-site database access closed until an actual data-backed public feature and exact table/column allowlist exist.
6. Replace demo permission identifiers and fake permission toggles with canonical, database-backed UI only after the authorization API/policies are implemented.
7. Validate using real test-user JWTs and the behavioral test plan; never use the real bootstrap superadmin for destructive tests.

## 3. Explicit non-claims

- This document does not claim that all application paths or external integrations have been exhaustively audited.
- It does not claim that RLS policies, the permission resolver, trusted admin workflows, or last-superadmin protection are complete.
- It does not authorize any permission seed, staging SQL application, or production change.
- The current UI's sample names, metrics, roster entries, and actions are demonstrations, not verified live database records.
