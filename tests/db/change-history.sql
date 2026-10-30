\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.check_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

SELECT pg_temp.check_true((SELECT event_type = 'price_changed' AND old_price = 100 AND new_price = 120 AND read
  FROM public.price_change_notifications WHERE id = '10000000-0000-0000-0000-000000000003'), 'legacy price event preserved');
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.price_change_notifications
  WHERE event_type = 'carrier_added' AND carrier_name = 'Legacy price fixture'), 'upgrade does not invent carrier additions');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.price_change_notifications(event_type, carrier_name)
      VALUES ('carrier_added', 'Forged lifecycle event');
    RAISE EXCEPTION 'FAIL: direct lifecycle event insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT id AS carrier_id FROM public.create_carrier_with_services(
  '{"name":"Lifecycle fixture","supported_countries":["CZ"]}',
  '[{"name":"Lifecycle parcel","shipment_type":"balik","price_per_unit":100}]') \gset
SELECT id AS service_id FROM public.services WHERE carrier_id = :'carrier_id' \gset
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.price_change_notifications
  WHERE event_type = 'carrier_added' AND carrier_name = 'Lifecycle fixture' AND carrier_id IS NULL
    AND service_id IS NULL AND old_price IS NULL AND new_price IS NULL AND read IS FALSE), 'addition recorded once without price/FK');

UPDATE public.carriers SET active = true WHERE id = :'carrier_id';
UPDATE public.carriers SET name = 'Lifecycle renamed', logo_url = '/updated.png', supported_countries = ARRAY['AT'] WHERE id = :'carrier_id';
UPDATE public.services SET name = 'Renamed parcel', shipment_type = 'paleta' WHERE id = :'service_id';
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.price_change_notifications
  WHERE carrier_name IN ('Lifecycle fixture', 'Lifecycle renamed')), 'no-op and metadata edits create no events');
UPDATE public.carriers SET active = false WHERE id = :'carrier_id';
UPDATE public.carriers SET active = false WHERE id = :'carrier_id';
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.price_change_notifications
  WHERE event_type = 'carrier_deactivated' AND carrier_name = 'Lifecycle renamed'), 'deactivation recorded once');
UPDATE public.carriers SET active = true WHERE id = :'carrier_id';
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.price_change_notifications
  WHERE event_type = 'carrier_activated' AND carrier_name = 'Lifecycle renamed'), 'reactivation recorded once');
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.price_change_notifications
  WHERE event_type = 'carrier_added' AND carrier_name = 'Lifecycle fixture'), 'addition keeps original name snapshot');

SELECT count(*) FROM public.mark_price_change_notifications_read(ARRAY(
  SELECT id FROM public.price_change_notifications WHERE carrier_name IN ('Lifecycle fixture', 'Lifecycle renamed')));
SELECT pg_temp.check_true((SELECT bool_and(read) FROM public.price_change_notifications
  WHERE carrier_name IN ('Lifecycle fixture', 'Lifecycle renamed')), 'existing read RPC supports lifecycle events');

DELETE FROM public.carriers WHERE id = :'carrier_id';
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.carriers WHERE id = :'carrier_id'), 'lifecycle history does not prevent existing hard delete');
SELECT pg_temp.check_true((SELECT count(*) = 3 FROM public.price_change_notifications
  WHERE carrier_name IN ('Lifecycle fixture', 'Lifecycle renamed')), 'lifecycle snapshots survive hard delete');

-- Failure after the carrier INSERT must roll back its event as well.
DO $$ BEGIN
  BEGIN
    PERFORM public.create_carrier_with_services(
      '{"name":"History rollback fixture","supported_countries":["CZ"]}',
      '[{"name":"valid","shipment_type":"balik","price_per_unit":100},{"name":"invalid","shipment_type":"invalid","price_per_unit":100}]');
    RAISE EXCEPTION 'FAIL: invalid service accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM pg_temp.check_true(NOT EXISTS(SELECT FROM public.price_change_notifications
    WHERE carrier_name = 'History rollback fixture'), 'failed creation leaves no lifecycle event');
END $$;

SELECT count(*) AS before_denied FROM public.price_change_notifications \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
UPDATE public.carriers SET active = false WHERE id = '10000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT pg_temp.check_true((SELECT count(*) = :before_denied FROM public.price_change_notifications), 'denied changes create no events');

SELECT 'PASS: legacy prices, lifecycle events, no-op edits, snapshots, read RPC, rollback and hard-delete compatibility' AS result;
