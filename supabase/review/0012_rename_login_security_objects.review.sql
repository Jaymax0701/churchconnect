-- ChurchConnect login security object naming cleanup
-- REVIEW ONLY. Apply manually to the verified active project after approval.
-- Renames existing objects in place; preserves login bucket data and function OIDs.
-- No thresholds, lockout behaviour, return shapes, or authorization rules are changed.

BEGIN;

-- 1. Rename tables without dropping or recreating data.
ALTER TABLE public.churchconnect_login_attempt_buckets
  RENAME TO login_attempt_buckets;

ALTER TABLE public.churchconnect_login_lockout_audit
  RENAME TO login_lockout_audit;

-- 2. Rename indexes and identity sequence for consistent catalog names.
ALTER INDEX public.churchconnect_login_attempt_buckets_pkey
  RENAME TO login_attempt_buckets_pkey;
ALTER INDEX public.churchconnect_login_attempts_last_failed_idx
  RENAME TO login_attempts_last_failed_idx;
ALTER INDEX public.churchconnect_login_buckets_user_lock_idx
  RENAME TO login_buckets_user_lock_idx;
ALTER INDEX public.churchconnect_login_lockout_audit_pkey
  RENAME TO login_lockout_audit_pkey;
ALTER SEQUENCE public.churchconnect_login_lockout_audit_id_seq
  RENAME TO login_lockout_audit_id_seq;

-- 3. Rename existing RPCs. Renaming preserves their existing grants and OIDs.
ALTER FUNCTION public.check_churchconnect_login_lockout(text, text)
  RENAME TO check_login_lockout;
ALTER FUNCTION public.record_churchconnect_login_failure(text, text)
  RENAME TO record_login_failure;
ALTER FUNCTION public.clear_churchconnect_login_failures(text)
  RENAME TO clear_login_failures;
ALTER FUNCTION public.record_churchconnect_login_failure_with_account(text, text, text)
  RENAME TO record_login_failure_with_account;
ALTER FUNCTION public.list_active_churchconnect_login_lockouts()
  RENAME TO list_active_login_lockouts;
ALTER FUNCTION public.admin_unlock_churchconnect_login_lockout(uuid)
  RENAME TO admin_unlock_login_lockout;

-- 4. Rebuild function bodies against the renamed table and RPCs.
-- SECURITY DEFINER, function signatures, return shapes, and empty search_path remain.

CREATE OR REPLACE FUNCTION public.check_login_lockout(
  p_email_ip_key text,
  p_ip_key text
)
RETURNS TABLE(is_locked boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_now timestamptz := clock_timestamp();
BEGIN
    IF p_email_ip_key IS NULL
       OR p_email_ip_key !~ '^[0-9a-f]{64}$'
       OR p_ip_key IS NULL
       OR p_ip_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid login security key.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT
        COALESCE(bool_or(b.locked_until > v_now), false),
        COALESCE(
            max(
                CEIL(EXTRACT(EPOCH FROM (b.locked_until - v_now)))::integer
            ) FILTER (WHERE b.locked_until > v_now),
            0
        )::integer
    FROM public.login_attempt_buckets b
    WHERE b.bucket_key IN (p_email_ip_key, p_ip_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_login_failure(
  p_email_ip_key text,
  p_ip_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_now timestamptz := clock_timestamp();
BEGIN
    IF p_email_ip_key IS NULL
       OR p_email_ip_key !~ '^[0-9a-f]{64}$'
       OR p_ip_key IS NULL
       OR p_ip_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid login security key.'
            USING ERRCODE = '22023';
    END IF;

    -- Email + IP bucket: threshold 3.
    INSERT INTO public.login_attempt_buckets AS existing (
        bucket_key, bucket_type, failed_attempts, window_started_at, last_failed_at
    )
    VALUES (p_email_ip_key, 'email_ip', 1, v_now, v_now)
    ON CONFLICT (bucket_key) DO UPDATE
    SET
        failed_attempts = CASE
            WHEN existing.locked_until > v_now THEN existing.failed_attempts
            WHEN existing.locked_until IS NOT NULL
              OR existing.window_started_at <= v_now - interval '30 minutes' THEN 1
            ELSE LEAST(existing.failed_attempts + 1, 3)
        END,
        window_started_at = CASE
            WHEN existing.locked_until > v_now THEN existing.window_started_at
            WHEN existing.locked_until IS NOT NULL
              OR existing.window_started_at <= v_now - interval '30 minutes' THEN v_now
            ELSE existing.window_started_at
        END,
        locked_until = CASE
            WHEN existing.locked_until > v_now THEN existing.locked_until
            WHEN existing.locked_until IS NOT NULL
              OR existing.window_started_at <= v_now - interval '30 minutes' THEN NULL
            WHEN existing.failed_attempts + 1 >= 3 THEN v_now + interval '15 minutes'
            ELSE NULL
        END,
        last_failed_at = v_now;

    -- Shared IP bucket: threshold 10.
    INSERT INTO public.login_attempt_buckets AS existing (
        bucket_key, bucket_type, failed_attempts, window_started_at, last_failed_at
    )
    VALUES (p_ip_key, 'ip', 1, v_now, v_now)
    ON CONFLICT (bucket_key) DO UPDATE
    SET
        failed_attempts = CASE
            WHEN existing.locked_until > v_now THEN existing.failed_attempts
            WHEN existing.locked_until IS NOT NULL
              OR existing.window_started_at <= v_now - interval '30 minutes' THEN 1
            ELSE LEAST(existing.failed_attempts + 1, 10)
        END,
        window_started_at = CASE
            WHEN existing.locked_until > v_now THEN existing.window_started_at
            WHEN existing.locked_until IS NOT NULL
              OR existing.window_started_at <= v_now - interval '30 minutes' THEN v_now
            ELSE existing.window_started_at
        END,
        locked_until = CASE
            WHEN existing.locked_until > v_now THEN existing.locked_until
            WHEN existing.locked_until IS NOT NULL
              OR existing.window_started_at <= v_now - interval '30 minutes' THEN NULL
            WHEN existing.failed_attempts + 1 >= 10 THEN v_now + interval '15 minutes'
            ELSE NULL
        END,
        last_failed_at = v_now;

    -- Remove a small batch of expired tracking records.
    WITH stale AS (
        SELECT bucket_key
        FROM public.login_attempt_buckets
        WHERE last_failed_at < v_now - interval '24 hours'
        ORDER BY last_failed_at
        LIMIT 100
    )
    DELETE FROM public.login_attempt_buckets b
    USING stale
    WHERE b.bucket_key = stale.bucket_key;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_login_failures(p_email_ip_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF p_email_ip_key IS NULL
       OR p_email_ip_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid login security key.'
            USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.login_attempt_buckets
    WHERE bucket_key = p_email_ip_key
      AND bucket_type = 'email_ip';
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_login_failure_with_account(
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

  PERFORM public.record_login_failure(p_email_ip_key, p_ip_key);

  UPDATE public.login_attempt_buckets
  SET user_id = v_user_id
  WHERE bucket_key = p_email_ip_key
    AND bucket_type = 'email_ip';
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_active_login_lockouts()
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
  FROM public.login_attempt_buckets AS b
  JOIN auth.users AS u ON u.id = b.user_id
  LEFT JOIN public.profiles AS p ON p.id = u.id
  WHERE b.bucket_type = 'email_ip'
    AND b.user_id IS NOT NULL
    AND b.locked_until > now()
  GROUP BY u.id, u.email, p.full_name
  ORDER BY max(b.locked_until) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_unlock_login_lockout(p_target_user_id uuid)
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
  FROM public.login_attempt_buckets AS b
  WHERE b.user_id = p_target_user_id
    AND b.bucket_type = 'email_ip';

  IF v_bucket_count > 0 THEN
    INSERT INTO public.login_lockout_audit (
      actor_user_id, target_user_id, action,
      removed_bucket_count, removed_failed_attempts, latest_locked_until
    ) VALUES (
      v_actor_id, p_target_user_id, 'admin_unlock_email_ip',
      v_bucket_count, v_failed_attempts, v_latest_locked_until
    );

    DELETE FROM public.login_attempt_buckets AS b
    WHERE b.user_id = p_target_user_id
      AND b.bucket_type = 'email_ip';
  END IF;

  RETURN QUERY SELECT v_bucket_count, v_failed_attempts;
END;
$function$;

-- 5. Reassert least-privilege RPC execution grants.
REVOKE ALL ON FUNCTION public.check_login_lockout(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_login_failure(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_login_failures(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_login_failure_with_account(text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_login_lockout(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_failure(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_login_failures(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_failure_with_account(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.list_active_login_lockouts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_unlock_login_lockout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_active_login_lockouts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlock_login_lockout(uuid) TO authenticated;

COMMIT;

-- Refresh PostgREST's schema cache so the renamed RPCs are available immediately.
NOTIFY pgrst, 'reload schema';

-- Post-application verification:
-- 1. Confirm the two tables and all six RPCs exist under their concise names.
-- 2. Confirm all six functions remain SECURITY DEFINER with an empty search_path.
-- 3. Confirm service_role-only RPCs deny anon/authenticated.
-- 4. Confirm admin listing/unlock deny anon and allow authenticated (with
--    in-function approved-global-superadmin authorization).
-- 5. Confirm bucket row count and audit row count were preserved.
