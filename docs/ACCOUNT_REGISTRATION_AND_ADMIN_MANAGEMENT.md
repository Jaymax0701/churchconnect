# ChurchConnect account registration and administration

This feature adds public self-registration, password recovery, and Superadmin-only account maintenance.

## Registration behavior

- Public route: `/signup`; sign-up is open.
- Required fields: full name, email, password, and password confirmation.
- Full name is submitted as Auth user metadata (`full_name`) for the existing `handle_new_auth_user_profile` trigger.
- The trigger creates the profile with `is_approved = false`.
- Email verification remains controlled by Supabase Auth.
- Account approval, role assignment, and congregation membership remain separate. Registration never assigns a role or membership.

## Admin behavior

The existing `/admin/users` directory adds:
- Edit full name.
- Request an email change. Supabase requires the new address to confirm before it becomes the account email.
- Send a password recovery email. Admins do not see, set, or retrieve the user's password.

Only an approved global `superadmin` can call the Edge Function. The function validates the caller's bearer token, checks the caller's approved profile and global role using the service-role client, rejects self-management, and writes an audit record. The service-role key is used only inside the Edge Function and must never be added to Vite environment variables or browser code.

## Manual deployment sequence

Use the current development/staging Supabase project only.

1. Review and manually apply `supabase/review/0006_admin_account_management_audit.review.sql` in the Supabase SQL Editor.
2. Deploy the Edge Function from the repository root:

   ```bash
   supabase functions deploy admin-manage-user --project-ref iikdiuezfnwgsjhvedzk
   ```

3. Set the Edge Function secret `APP_ORIGIN` to:

   ```text
   https://churchconnect-alpha.vercel.app
   ```

   Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Do not expose the service-role key to the frontend.

4. In Supabase Auth URL Configuration, allow:
   - Site URL: `https://churchconnect-alpha.vercel.app`
   - Redirect URL: `https://churchconnect-alpha.vercel.app/login`
   - Redirect URL: `https://churchconnect-alpha.vercel.app/reset-password`

5. Confirm email confirmation is enabled in Supabase Auth if registrations should verify their email before approval.

## Acceptance tests

- A visitor can register with full name, email and password.
- The profile trigger creates exactly one profile with the submitted full name and `is_approved = false`.
- A new registration receives no role assignment and no congregation membership automatically.
- The new user must verify email and then wait for Superadmin approval.
- A non-Superadmin cannot call `admin-manage-user`, even if they invoke it directly.
- An approved global Superadmin can update another user's name.
- An email change is not considered complete until the new address confirms it.
- A Superadmin can send a password recovery email; no admin can read or set the user's existing password.
- Each successful action produces an `admin_account_audit` row.
- Self-management through this endpoint is rejected.
