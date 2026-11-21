# AGENTS.md — ChurchConnect contributor instructions

These instructions apply to all work in this repository unless a more specific instruction file overrides them.

## Project overview

- Application: ChurchConnect
- Stack: React, TypeScript, Vite, Supabase, and Vercel
- Production frontend: https://churchconnect-alpha.vercel.app/
- Active Supabase project ref: `iikdiuezfnwgsjhvedzk`
- Frontend Supabase client configuration: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `src/lib/supabase.ts`.

Do not assume that the production database is disposable. Verify the project ref before every database operation.

## Working style and approvals

- Make focused, incremental changes. Explain the purpose and impact of each meaningful change.
- Prefer small, reviewable pull requests.
- Do not merge pull requests, apply SQL to Supabase, change production configuration, or manually deploy production without the project owner's explicit approval.
- A merge may trigger an automatic Vercel production deployment. Warn about this before recommending a merge.
- A GitHub merge does not automatically apply SQL review scripts or deploy Supabase Edge Functions.
- Provide copy-paste-ready commands and SQL when requested. Do not ask the owner to expose credentials.

## Security requirements

- Treat all client input as untrusted.
- Use Supabase RPC parameters and query-builder bindings; never concatenate user-controlled values into SQL strings.
- Do not put service-role keys, Supabase secret API keys, HMAC secrets, passwords, access tokens, or refresh tokens in frontend code, `VITE_*` variables, logs, fixtures, commits, or documentation examples.
- Use least-privilege grants and explicit authorization checks for privileged operations.
- Sensitive tables must have appropriate RLS enabled. Verify both grants and policies; RLS alone is not a substitute for correct grants.
- SECURITY DEFINER functions must use a fixed or empty `search_path`, schema-qualify object references, validate caller authorization, and have narrowly scoped EXECUTE grants.
- Never trust a role or user ID supplied by the browser as proof of authorization. Derive the caller identity from the authenticated session (for example, `auth.uid()`) and verify privileges server-side.
- Avoid logging raw login request bodies, email/IP identifiers, passwords, tokens, or secrets.
- Keep generic authentication failure messages to avoid account enumeration.
- Do not weaken rate limits, RLS, authorization, or input validation to make a UI feature work.

## Secure password login

ChurchConnect password sign-in is routed through `supabase/functions/secure-login/index.ts`, invoked by the frontend using the function slug `secure-login`.

Operational requirements:

- The deployed function name must be exactly `secure-login`.
- Configure `LOGIN_RATE_LIMIT_SECRET` as a Supabase Edge Function secret; it must never be a frontend variable.
- The function uses Supabase-provided server environment variables, including the service-role key for restricted counter RPCs and the new-format secret API key for Auth IP forwarding.
- Set Verify JWT OFF for `secure-login` only, because the caller has not authenticated yet. Keep JWT verification enabled for unrelated protected functions.
- Enable Supabase Auth IP Address Forwarding for the `Sb-Forwarded-For` header.
- Custom rate limits apply only to password logins that pass through this function. Direct Supabase Auth calls do not pass through the custom counters.
- Current configured policy: three failures for an email + IP bucket trigger a 15-minute cooldown; ten failures for an IP bucket across accounts trigger a 15-minute cooldown. Successful sign-in clears the email + IP bucket but not the shared IP bucket.
- A lockout is not necessarily a global account ban. The email + IP bucket is specific to that network; the shared IP bucket can affect multiple accounts behind the same public IP.
- Existing sessions are not revoked when a cooldown begins.
- See `supabase/functions/secure-login/README.md` for deployment and operational details.

## Administrative lockout monitoring

- The Account Login Security panel is intended for approved global superadmins only.
- The displayed status represents active email + IP buckets associated with registered Auth users, not a global account suspension.
- Do not expose raw IP addresses or HMAC keys in the admin UI.
- Manual unlock clears the target user's email + IP buckets only. It must not silently clear shared IP-wide buckets.
- Unlock operations must be audited server-side.
- Account association begins when failed attempts are recorded through the account-aware RPC. Do not claim that old buckets have been backfilled.
- Login security database objects use concise names: `login_attempt_buckets`, `login_lockout_audit`, `check_login_lockout`, `record_login_failure`, `clear_login_failures`, `record_login_failure_with_account`, `list_active_login_lockouts`, and `admin_unlock_login_lockout`.
- Their purposes, parameters, grants, and authorization rules belong in the SQL migration and `supabase/functions/secure-login/README.md`, not in unnecessarily long object names.
- Review SQL for the account-aware monitoring enhancement is in `supabase/review/0011_admin_login_lockout_monitoring.review.sql`; the rename migration will be tracked separately.

## Database change workflow

- Inspect the live schema before writing or applying SQL: tables, columns, constraints, indexes, triggers, RLS policies, grants, and existing function definitions.
- Preserve existing behavior and avoid destructive changes.
- Files in `supabase/review/` are manual review scripts, not automatically applied migrations. Do not run them without explicit approval.
- Use transactions where appropriate and include post-change catalog checks and behavioral test plans.
- Test privileged RPCs with both authorized and unauthorized authenticated users.
- Verify that service-role-only functions cannot be executed by `anon` or `authenticated`.
- Do not assume SQL syntax or schema names from memory; inspect the repository and current database evidence.

## Frontend and quality checks

- Follow existing component patterns, design tokens, and UI primitives. Avoid introducing a second design system.
- Keep admin-only functionality behind both UI-level visibility and server-side authorization.
- Handle loading, empty, error, and success states.
- Avoid leaking raw database or infrastructure errors to ordinary users; show safe messages and log only sanitized diagnostic context.
- Run `npm run lint` and `npm run build` after code changes when the environment permits. Report clearly if they were not run.
- Review the diff for unrelated edits, type errors, stale imports, and accessibility concerns.

## Deployment and completion reporting

When finishing a task, report:
1. Files changed.
2. Security-sensitive behavior and authorization boundaries.
3. Checks actually run and their results.
4. SQL or Edge Function operations still requiring manual deployment.
5. Whether a merge could trigger production deployment.

Never describe a focused code change as a complete application security audit.
