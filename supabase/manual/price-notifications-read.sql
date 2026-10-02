-- MANUAL REVIEW ONLY. Never run this file automatically against a remote project.
-- Apply as the database owner only after supabase/manual/admin-crud.sql.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.price_change_notifications', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated must not have direct UPDATE on price_change_notifications';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'price_change_notifications'
      AND policyname = 'admin_notification_read' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Expected admin_notification_read policy is missing';
  END IF;
END $$;

CREATE FUNCTION public.mark_price_change_notifications_read(notification_ids uuid[])
RETURNS TABLE(notification_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_profiles ap
    WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(cardinality(notification_ids), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE public.price_change_notifications AS notification
    SET read = true
    WHERE notification.id = ANY(notification_ids)
      AND notification.read IS FALSE
    RETURNING notification.id;
END $$;

REVOKE ALL ON FUNCTION public.mark_price_change_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_price_change_notifications_read(uuid[]) TO authenticated;
REVOKE UPDATE ON public.price_change_notifications FROM PUBLIC, anon, authenticated;
COMMIT;
