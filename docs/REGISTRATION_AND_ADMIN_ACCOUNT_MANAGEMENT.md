# ChurchConnect registration and account management

## Included application changes

- Public `/signup` form: full name, email, password and confirmation.
- Login page links to account creation.
- New accounts use Supabase Auth sign-up metadata `full_name`; the existing `on_auth_user_created_profile` trigger creates a profile with `is_approved = false`.
- Registration does not assign a role or approve the account.
- Public `/reset-password` route receives recovery links and lets the account owner set a new password.
- Superadmin User Accounts page can request a password-reset email and edit a user's name/email.

## Required Supabase deployment

The account-edit action uses a Supabase Edge Function. Deploy it from the repository root:

```bash
supabase functions deploy admin-update-user
```

The function expects the standard Supabase Edge Function environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not add the service-role key to Vercel client-side environment variables or any `VITE_*` variable. Supabase provides the service-role key to the Edge Function environment.

The function validates the caller's JWT, then independently verifies that the caller has an approved profile and a global `superadmin` assignment before updating a target account. It does not grant roles, approve accounts, or alter membership.

## Auth email configuration

In Supabase Authentication URL Configuration, add the deployed URLs to the allowed redirect URLs:
- `https://churchconnect-alpha.vercel.app/pending`
- `https://churchconnect-alpha.vercel.app/reset-password`

Add corresponding localhost URLs if testing locally. Confirm that email confirmation and password recovery email delivery are configured for the project. Email change behavior is governed by the Supabase Auth email-change confirmation settings.

## Manual verification

1. Register a disposable account with a real email address.
2. Verify the email, then confirm the account remains unapproved until an administrator approves it.
3. Confirm no role or congregation membership is automatically assigned.
4. Sign in as the global Superadmin and open `/admin/users`.
5. Edit a test account's name and email; confirm the name appears in the directory and complete any email confirmation required by Supabase.
6. Request a password reset and use the email link to set a new password.
7. Confirm a non-Superadmin cannot invoke the account-edit Edge Function.

No database migration is included in this feature. The existing account profile trigger, approval workflow, and `list_user_accounts()` RPC are reused.
