# Secure login gateway

The `secure-login` Edge Function is the ChurchConnect password sign-in entry point. It calls Supabase Auth with the project's public/anonymous key, records failed attempts through narrowly scoped database RPCs, and returns the resulting access/refresh tokens to the browser for `supabase.auth.setSession()`.

## Required Edge Function secret

Set `LOGIN_RATE_LIMIT_SECRET` in Supabase Dashboard → Edge Functions → Secrets. Use a cryptographically random value with at least 32 characters. Do not put this value in Vite environment variables, GitHub source, or browser code.

Example generation command (run locally; do not commit the output):

```bash
openssl rand -hex 32
```

The function uses these Supabase Edge Function environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` for the restricted login-counter RPCs
- `SUPABASE_SECRET_KEYS` (Supabase-provided JSON map; the function uses its `default` secret key for password sign-in)

The Auth request uses the new-format secret API key with the `Sb-Forwarded-For` header. Supabase requires a secret API key for forwarded-IP Auth rate limiting; the legacy anonymous and service-role keys do not support that feature.

Optional configuration:

- `APP_ORIGIN` (defaults to `https://churchconnect-alpha.vercel.app`)
- `ADDITIONAL_ALLOWED_ORIGINS` (comma-separated exact origins, for additional development domains)

## Deployment configuration

The `supabase/config.toml` entry sets `verify_jwt = false` for this function because password sign-in occurs before a user session exists. The function must therefore be treated as a public endpoint: it validates input, checks the gateway-provided client IP, applies the database lockout counters, and never returns secrets.

When deploying from the Supabase Dashboard, turn off **Verify JWT** for `secure-login`. When deploying with the Supabase CLI, deploy with the repository configuration applied:

```bash
supabase functions deploy secure-login
```

Do not disable JWT verification for other functions.

## Lockout policy

- Three failed password attempts for the same normalized email + client IP: 15-minute cooldown.
- Ten failed attempts from one client IP across accounts: 15-minute cooldown.
- The email/IP counter clears after a successful sign-in.
- The shared IP counter remains to slow password spraying across accounts.
- Counters use HMAC-SHA-256 keys. Raw email addresses and IP addresses are not stored in the tracking table.
- The application returns a generic sign-in failure message for invalid credentials, unknown accounts, and unverified email addresses.

The custom counters apply to password sign-ins made through ChurchConnect. Direct calls to Supabase Auth do not pass through this gateway and remain subject to Supabase Auth's own rate limits.

## Operational notes

- Never log passwords, access tokens, refresh tokens, HMAC keys, or raw login request bodies.
- Do not expose the service-role key or HMAC secret to the browser.
- The IP-based bucket can affect users sharing a public IP. Review rate-limit logs and user reports before changing thresholds.
- This implementation does not invalidate existing sessions when a login cooldown starts.
