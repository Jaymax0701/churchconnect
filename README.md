# ChurchConnect

**Connecting people. Strengthening faith. Building community.**

ChurchConnect is a church-community platform for coordinating church administration, communication, ministries, and member engagement.

## Live application

- Production: https://churchconnect-alpha.vercel.app/

## Technology

- React + TypeScript
- Vite
- Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions)
- Vercel hosting and deployment
- GitHub repository: https://github.com/Jaymax0701/churchconnect

## Core application areas

ChurchConnect is being developed around public church information, member access, congregation and family management, ministry coordination, events, and administrative operations. Availability of individual modules depends on the current application release and assigned permissions.

## Authentication and account security

Password sign-in is routed through the Supabase Edge Function:

`supabase/functions/secure-login/index.ts`

The function is invoked by the frontend as `secure-login` and is deployed at:

`https://iikdiuezfnwgsjhvedzk.supabase.co/functions/v1/secure-login`

The function uses a server-side `LOGIN_RATE_LIMIT_SECRET`, Supabase-provided server environment variables, and restricted database RPCs. Never place these secrets in Vite environment variables, browser code, Git commits, screenshots, or chat messages.

### Cloudflare Turnstile

The frontend uses Cloudflare Turnstile for password login (`login`), account signup (`signup`), forgot-password email requests (`password_reset`), and superadmin-initiated password resets (`admin_password_reset`).

Server-side verification is performed by the `secure-login` and `admin-manage-user` Edge Functions. Signup and forgot-password requests pass their tokens to Supabase Auth through its native CAPTCHA integration. **Supabase Auth CAPTCHA must be configured with Cloudflare Turnstile and enabled for those two flows to receive server-side verification; a browser widget alone is not sufficient.** Keep it disabled until the Cloudflare secret, Auth provider configuration, redirect allowlist, Edge Functions, and end-to-end flows have been verified together.

Operational requirements:
- Set `VITE_TURNSTILE_SITE_KEY` in Vercel Preview and Production. This is a public site key.
- Configure `TURNSTILE_SECRET_KEY` as a Supabase Edge Function secret. Use the same Cloudflare secret in Supabase Auth's native CAPTCHA provider configuration when enabling Auth CAPTCHA.
- Never put the Turnstile secret in a `VITE_*` variable, GitHub, browser code, screenshots, or chat messages.
- Allow the production hostname `churchconnect-alpha.vercel.app` in the Cloudflare Turnstile widget configuration.
- Include `http://localhost:5173/**` and `https://churchconnect-alpha.vercel.app/**` in the Supabase Auth redirect allowlist.
- Deploy `secure-login` and `admin-manage-user` after configuring server-side secrets. Function deployments are separate from GitHub merges and Vercel frontend deployments.
- Keep Verify JWT disabled only for `secure-login`; keep JWT verification enabled for `admin-manage-user`.

### Current login rate-limit policy

- Three failed password attempts for the same normalized email + client IP: 15-minute cooldown.
- Ten failed attempts from one client IP across accounts: 15-minute cooldown.
- Successful sign-in clears the email + IP bucket; the shared IP bucket is retained.
- Counters use HMAC-SHA-256 keys. The tracking table does not store raw email addresses or IP addresses.
- The custom counters protect password sign-ins routed through ChurchConnect. Direct Supabase Auth requests bypass the custom counters and remain subject to Supabase's own limits.
- Existing sessions are not revoked when a login cooldown begins.

### Administrative lockout monitoring

The Account Login Security panel is part of the admin account-management page. It is designed for approved global superadmins and reports active **email + IP** blocks associated with registered accounts.

- A displayed block is not a global account suspension. The account may still be able to sign in from another IP address.
- Shared IP-wide blocks are not presented as account-specific lockouts.
- Administrators do not see raw IP addresses or HMAC keys.
- The audited unlock action clears the selected account's email + IP buckets. It does not clear shared IP-wide buckets.
- Account association is populated when failed login attempts are recorded through the account-aware RPC. Existing buckets created before that change are not automatically backfilled.
- The login security objects use concise database names: `login_attempt_buckets`, `login_lockout_audit`, and the `check_login_lockout`, `record_login_failure`, `clear_login_failures`, `record_login_failure_with_account`, `list_active_login_lockouts`, and `admin_unlock_login_lockout` RPCs. Their responsibilities and security boundaries are documented in `supabase/review/0012_rename_login_security_objects.review.sql` and `supabase/functions/secure-login/README.md`. Files under `supabase/review/` are review/manual-application scripts, not automatically applied migrations.

### Edge Function deployment requirements

- Deploy the function under the exact name `secure-login`.
- Configure `LOGIN_RATE_LIMIT_SECRET` in Supabase Edge Function secrets.
- `verify_jwt = false` is required for this login endpoint because users are not authenticated before password sign-in. Do not disable JWT verification for unrelated functions.
- Enable Supabase Auth IP Address Forwarding for the `Sb-Forwarded-For` header.
- Never expose the service-role key, secret API key, or login HMAC secret to the browser.
- The old automatically named `swift-responder` function is not the frontend endpoint. Do not remove it until its use has been checked and the correct `secure-login` endpoint is verified.

See [secure-login operational notes](supabase/functions/secure-login/README.md).

## Local development

Install dependencies and use the project scripts:

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

Required frontend environment variables are configured through the Vite environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Only publishable client configuration belongs in frontend environment variables. Never use a Supabase service-role key or secret API key as a `VITE_*` variable.

## Database change workflow

- Review the exact target Supabase project before running SQL.
- Inspect existing table definitions, constraints, grants, RLS policies, and function signatures before modifying database objects.
- Treat `supabase/review/*.review.sql` as manual review scripts. They are not migrations and are not automatically deployed.
- Apply database changes only after explicit approval and after checking the script against the live schema.
- Prefer least-privilege grants, enabled RLS for sensitive tables, SECURITY DEFINER functions with a fixed/empty `search_path`, explicit authorization checks, and narrowly scoped RPC parameters.
- Never assume that a GitHub merge deploys an Edge Function or applies SQL. Those are separate operational steps.

## Deployment

The production frontend is hosted on Vercel. Merging to the configured production branch may trigger an automatic Vercel deployment. Confirm the deployment target and status after a merge. Do not initiate a manual production deployment without explicit approval.

## Security reporting

A passing build or a focused feature review is not a complete security audit. When reporting security status, state exactly what was inspected and tested, identify unverified paths, and do not claim that SQL injection, authorization, RLS, or the entire application is fully secure without a comprehensive review.

---

*Built with a heart for the church and a vision for technology that makes a difference.*
