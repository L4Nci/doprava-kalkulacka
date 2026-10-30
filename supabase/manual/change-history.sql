-- MANUAL REVIEW ONLY. Never run this file automatically against a remote project.
-- Apply as the database owner after admin-crud.sql, carrier-lifecycle.sql and
-- price-notifications-read.sql. This is a one-time script, not a CLI migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'carriers'
      AND column_name = 'active' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'price_change_notifications'
      AND policyname = 'admin_notification_from_trigger' AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Expected carrier lifecycle and notification policies are missing';
  END IF;
END $$;

-- Existing rows and the unchanged price trigger retain their original meaning.
ALTER TABLE public.price_change_notifications
  ADD COLUMN event_type text NOT NULL DEFAULT 'price_changed'
    CHECK (event_type IN ('price_changed', 'carrier_added', 'carrier_deactivated', 'carrier_activated')),
  ADD COLUMN carrier_name text;

COMMENT ON COLUMN public.price_change_notifications.carrier_name IS
  'Carrier name at the time of a lifecycle event; preserved after rename or deletion.';

CREATE FUNCTION public.log_carrier_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  change_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    change_type := 'carrier_added';
  ELSIF OLD.active IS DISTINCT FROM NEW.active THEN
    change_type := CASE WHEN NEW.active THEN 'carrier_activated' ELSE 'carrier_deactivated' END;
  ELSE
    RETURN NEW;
  END IF;

  -- Lifecycle events deliberately have no carrier/service FK. The existing
  -- price-history FKs still protect prices, while a carrier without price
  -- history remains deletable exactly as before this extension.
  INSERT INTO public.price_change_notifications(event_type, carrier_name)
  VALUES (change_type, NEW.name);
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.log_carrier_changes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER track_carrier_changes
AFTER INSERT OR UPDATE OF active ON public.carriers
FOR EACH ROW EXECUTE FUNCTION public.log_carrier_changes();

-- Existing notification RLS, read RPC, Realtime publication and price trigger
-- remain unchanged. Failed carrier/service transactions also roll back events.
COMMIT;
