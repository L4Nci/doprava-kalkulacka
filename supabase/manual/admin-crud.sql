-- MANUAL REVIEW ONLY. Never run this file automatically against a remote project.
-- Baseline: six tables exported 2026-09-30; no pre-existing write policies on the three CRUD tables.
-- Run as the database owner, in one transaction, only after approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

-- Fail closed if the reviewed authorization baseline has drifted.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('products', 'carriers', 'services')
      AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Write policies already exist: review them before applying this script';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('products', 'carriers', 'services', 'admin_profiles', 'price_change_notifications')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Expected RLS to be enabled';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'admin_profiles') <> 2
  OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_profiles'
      AND policyname = 'allow_admin_access' AND cmd = 'ALL'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_profiles'
      AND policyname = 'allow_read_for_authenticated' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'admin_profiles policies differ from the reviewed baseline';
  END IF;
END $$;

-- Remove the legacy hardcoded-UUID write path. Browser clients may only read their
-- own profile; trusted database/server administration retains owner/service access.
REVOKE ALL ON public.admin_profiles FROM PUBLIC, anon, authenticated;
DROP POLICY "allow_admin_access" ON public.admin_profiles;
DROP POLICY "allow_read_for_authenticated" ON public.admin_profiles;
CREATE POLICY read_own_profile ON public.admin_profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
GRANT SELECT ON public.admin_profiles TO authenticated;

-- Direct EXISTS is non-recursive: read_own_profile only compares the row id with
-- auth.uid() and does not query admin_profiles or any CRUD table.
-- No UUID and no SECURITY DEFINER helper. Existing public CRUD SELECT policies stay unchanged.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.products FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.products FROM authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
CREATE POLICY admin_insert ON public.products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));
CREATE POLICY admin_update ON public.products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));
CREATE POLICY admin_delete ON public.products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.carriers FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.carriers FROM authenticated;
GRANT SELECT ON public.carriers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.carriers TO authenticated;
CREATE POLICY admin_insert ON public.carriers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));
CREATE POLICY admin_update ON public.carriers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));
CREATE POLICY admin_delete ON public.carriers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.services FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.services FROM authenticated;
GRANT SELECT ON public.services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
CREATE POLICY admin_insert ON public.services FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));
CREATE POLICY admin_update ON public.services FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));
CREATE POLICY admin_delete ON public.services FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));

-- Keep log_price_changes() as SECURITY INVOKER and preserve its five-second logic.
-- The invoker must see the latest notification and be able to insert from a trigger.
-- Admin membership is the authorization boundary. Browser roles cannot create triggers,
-- and trigger depth prevents a direct Data API INSERT from satisfying this policy.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.price_change_notifications FROM PUBLIC, anon, authenticated;
CREATE POLICY admin_notification_read ON public.price_change_notifications
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));
CREATE POLICY admin_notification_from_trigger ON public.price_change_notifications
  FOR INSERT TO authenticated
  WITH CHECK (pg_trigger_depth() > 0 AND EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE));
GRANT SELECT, INSERT ON public.price_change_notifications TO authenticated;

-- Existing notification foreign keys remain NO ACTION. A recorded price history
-- therefore deliberately prevents deletion of its service and carrier.

-- Atomic creation: both inserts run under the caller's RLS, or both roll back.
CREATE FUNCTION public.create_carrier_with_services(carrier_data jsonb, service_data jsonb)
RETURNS SETOF public.carriers
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  new_carrier public.carriers;
  service jsonb;
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = (SELECT auth.uid()) AND ap.is_super_admin IS TRUE)) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(carrier_data) IS DISTINCT FROM 'object'
    OR NULLIF(btrim(carrier_data->>'name'), '') IS NULL
    OR jsonb_typeof(carrier_data->'supported_countries') IS DISTINCT FROM 'array'
    OR jsonb_typeof(service_data) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid carrier or services' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(service_data) = 0
    OR jsonb_array_length(carrier_data->'supported_countries') = 0 THEN
    RAISE EXCEPTION 'Country and service required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.carriers(name, logo_url, supported_countries)
  VALUES (btrim(carrier_data->>'name'), carrier_data->>'logo_url',
    ARRAY(SELECT jsonb_array_elements_text(carrier_data->'supported_countries')))
  RETURNING * INTO new_carrier;

  FOR service IN SELECT value FROM jsonb_array_elements(service_data) LOOP
    IF NULLIF(btrim(service->>'name'), '') IS NULL
      OR service->>'shipment_type' IS NULL
      OR service->>'shipment_type' NOT IN ('balik', 'paleta')
      OR service->>'price_per_unit' IS NULL
      OR service->>'price_per_unit' !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Invalid service' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.services(carrier_id, name, shipment_type, price_per_unit)
    VALUES (new_carrier.id, btrim(service->>'name'), service->>'shipment_type',
      (service->>'price_per_unit')::integer);
  END LOOP;
  RETURN NEXT new_carrier;
END $$;
REVOKE ALL ON FUNCTION public.create_carrier_with_services(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_carrier_with_services(jsonb, jsonb) TO authenticated;
COMMIT;
