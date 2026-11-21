-- ChurchConnect: Superadmin login lockout monitoring
-- REVIEW ONLY. Do not apply to production until the owner approves.
-- Adds account association to email+IP buckets without storing raw email/IP values.
-- IP-only buckets remain anonymous and are intentionally not shown as account lockouts.

BEGIN;

ALTER TABLE public.churchconnect_login_attempt_buckets
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS churchconnect_login_buckets_user_lock_idx
  ON public.churchconnect_login_attempt_buckets (user_id, locked_until DESC)
  WHERE bucket_type = 'email_ip';

CREATE TABLE IF NOT EXISTS public.churchconnect_login_lockout_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action = 'admin_unlock_email_ip'),
  removed_bucket_count integer NOT NULL CHECK (removed_bucket_count >= 0),
  removed_failed_attempts integer NOT NULL CHECK (removed_failed_attempts >= 0),
  latest_locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.churchconnect_login_lockout_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.churchconnect_login_lockout_audit FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.churchconnect_login_lockout_audit_id_seq FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_churchconnect_login_failure_with_account(
  p_email_ip_key text,
  p_ip_key text,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT u.id
    INTO v_user_id
  FROM auth.users AS u
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;

  PERFORM public.record_churchconnect_login_failure(p_email_ip_key, p_ip_key);

  UPDATE public.churchconnect_login_attempt_buckets
  SET user_id = v_user_id
  WHERE bucket_key = p_email_ip_key
    AND bucket_type = 'email_ip';
END;
$function$;

REVOKE ALL ON FUNCTION public.record_churchconnect_login_failure_with_account(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_churchconnect_login_failure_with_account(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.record_churchconnect_login_failure_with_account(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_churchconnect_login_failure_with_account(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.list_active_churchconnect_login_lockouts()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  active_network_blocks integer,
  highest_failed_attempts integer,
  latest_locked_until timestamptz,
  latest_failed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
BEGIN
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS actor_profile
    JOIN public.user_roles AS actor_role
      ON actor_role.user_id = actor_profile.id
    WHERE actor_profile.id = v_actor_id
      AND actor_profile.is_approved IS TRUE
      AND actor_role.role_id = 'superadmin'
      AND actor_role.scope_type = 'global'
      AND actor_role.ministry_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Not authorized to view login lockouts'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    p.full_name,
    count(*)::integer,
    max(b.failed_attempts)::integer,
    max(b.locked_until),
    max(b.last_failed_at)
  FROM public.churchconnect_login_attempt_buckets AS b
  JOIN auth.users AS u ON u.id = b.user_id
  LEFT JOIN public.profiles AS p ON p.id = u.id
  WHERE b.bucket_type = 'email_ip'
    AND b.user_id IS NOT NULL
    AND b.locked_until > now()
  GROUP BY u.id, u.email, p.full_name
  ORDER BY max(b.locked_until) DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_active_churchconnect_login_lockouts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_active_churchconnect_login_lockouts() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_active_churchconnect_login_lockouts() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unlock_churchconnect_login_lockout(
  p_target_user_id uuid
)
RETURNS TABLE (
  removed_bucket_count integer,
  removed_failed_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_bucket_count integer;
  v_failed_attempts integer;
  v_latest_locked_until timestamptz;
BEGIN
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS actor_profile
    JOIN public.user_roles AS actor_role
      ON actor_role.user_id = actor_profile.id
    WHERE actor_profile.id = v_actor_id
      AND actor_profile.is_approved IS TRUE
      AND actor_role.role_id = 'superadmin'
      AND actor_role.scope_type = 'global'
      AND actor_role.ministry_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Not authorized to unlock login attempts'
      USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user is required' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer,
         COALESCE(sum(b.failed_attempts), 0)::integer,
         max(b.locked_until)
    INTO v_bucket_count, v_failed_attempts, v_latest_locked_until
  FROM public.churchconnect_login_attempt_buckets AS b
  WHERE b.user_id = p_target_user_id
    AND b.bucket_type = 'email_ip';

  IF v_bucket_count > 0 THEN
    INSERT INTO public.churchconnect_login_lockout_audit (
      actor_user_id, target_user_id, action,
      removed_bucket_count, removed_failed_attempts, latest_locked_until
    ) VALUES (
      v_actor_id, p_target_user_id, 'admin_unlock_email_ip',
      v_bucket_count, v_failed_attempts, v_latest_locked_until
    );

    DELETE FROM public.churchconnect_login_attempt_buckets AS b
    WHERE b.user_id = p_target_user_id
      AND b.bucket_type = 'email_ip';
  END IF;

  RETURN QUERY SELECT v_bucket_count, v_failed_attempts;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_unlock_churchconnect_login_lockout(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unlock_churchconnect_login_lockout(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_unlock_churchconnect_login_lockout(uuid) TO authenticated;

COMMIT;

-- Verification (run after applying in the intended project):
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'record_churchconnect_login_failure_with_account',
--     'list_active_churchconnect_login_lockouts',
--     'admin_unlock_churchconnect_login_lockout'
--   );
--
-- The admin listing is intentionally limited to active email+IP blocks.
-- It does not reveal IP addresses or HMAC keys and does not claim a global account ban.
-- The unlock RPC clears only the target user's email+IP buckets; shared IP buckets remain.
-- Audit rows are written in the same transaction as a successful unlock.
