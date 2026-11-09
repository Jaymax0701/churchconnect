-- ChurchConnect: audit trail for privileged account-management actions
-- REVIEW ONLY. Apply manually to the current development/staging Supabase project.
-- The table is writable only by service_role (used by the trusted Edge Function).
-- No client-side account-management or auth.users access is granted here.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_account_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('update_account', 'send_password_reset')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_account_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_account_audit FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.admin_account_audit TO service_role;

COMMIT;

-- Verification:
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', 'public.admin_account_audit', 'INSERT') AS anon_can_insert,
  has_table_privilege('authenticated', 'public.admin_account_audit', 'INSERT') AS authenticated_can_insert,
  has_table_privilege('service_role', 'public.admin_account_audit', 'INSERT') AS service_role_can_insert
FROM pg_class c
WHERE c.oid = 'public.admin_account_audit'::regclass;
