-- ChurchConnect: single-congregation member relationship
-- REVIEW ONLY. Do not execute automatically or place in supabase/migrations.
--
-- Design:
-- - A congregation membership is distinct from account approval and role assignment.
-- - One membership row per Auth user supports the current single-congregation model.
-- - Status is explicitly managed: pending, active, or inactive.
-- - Members can read only their own membership.
-- - Client-side membership writes are intentionally not granted. Assignment remains
--   an administrative operation until the admin membership workflow and its
--   authorization policies are reviewed and implemented.

BEGIN;

CREATE TABLE IF NOT EXISTS public.congregation_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE
    REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'inactive')),
  member_since date,
  created_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.congregation_memberships ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.congregation_memberships FROM anon;
REVOKE ALL ON TABLE public.congregation_memberships FROM authenticated;
GRANT SELECT ON TABLE public.congregation_memberships TO authenticated;

DROP POLICY IF EXISTS "Members can read their own congregation membership"
  ON public.congregation_memberships;

CREATE POLICY "Members can read their own congregation membership"
  ON public.congregation_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMIT;

-- Verification after a separately approved execution:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'congregation_memberships'
-- ORDER BY ordinal_position;
--
-- Membership assignment example for a trusted database administrator only:
-- INSERT INTO public.congregation_memberships
--   (user_id, status, member_since, created_by)
-- VALUES
--   ('<verified-auth-user-uuid>', 'active', CURRENT_DATE, '<admin-auth-user-uuid>')
-- ON CONFLICT (user_id) DO UPDATE
-- SET status = EXCLUDED.status,
--     member_since = EXCLUDED.member_since,
--     created_by = EXCLUDED.created_by,
--     updated_at = now();
--
-- Do not run the example with placeholder UUIDs.
