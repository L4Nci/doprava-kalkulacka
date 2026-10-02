\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.check_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT id AS carrier_id FROM public.create_carrier_with_services(
  '{"name":"GLS HU","logo_url":"","supported_countries":["HU"]}',
  '[{"name":"Test parcel","shipment_type":"balik","price_per_unit":100}]') \gset
SELECT id AS service_id FROM public.services WHERE carrier_id = :'carrier_id' \gset
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.carriers WHERE id = :'carrier_id' AND name = 'GLS HU'), 'carrier persisted');
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.services WHERE carrier_id = :'carrier_id'), 'service persisted');
SELECT pg_temp.check_true((SELECT active FROM public.carriers WHERE id = :'carrier_id'), 'new carrier defaults active');
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.admin_profiles), 'admin sees only own profile');
SELECT pg_temp.check_true((SELECT bool_and(id = auth.uid()) FROM public.admin_profiles), 'admin cannot see another profile');
DO $$ BEGIN
  BEGIN
    UPDATE public.admin_profiles SET is_super_admin = false WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL: admin browser changed is_super_admin';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE public.services SET price_per_unit = 234 WHERE id = :'service_id' RETURNING id, price_per_unit;
SELECT pg_temp.check_true((SELECT price_per_unit = 234 FROM public.services WHERE id = :'service_id'), 'price persisted');
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.price_change_notifications WHERE service_id = :'service_id' AND new_price = 234), 'invoker trigger inserted notification');
UPDATE public.services SET price_per_unit = 235 WHERE id = :'service_id';
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.price_change_notifications WHERE service_id = :'service_id'), 'five-second throttle preserved');
UPDATE public.carriers SET active = false WHERE id = :'carrier_id';
SELECT pg_temp.check_true((SELECT active IS FALSE FROM public.carriers WHERE id = :'carrier_id'), 'admin deactivated carrier');
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.services WHERE carrier_id = :'carrier_id'), 'deactivation retained services');
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.price_change_notifications WHERE service_id = :'service_id'), 'deactivation retained price history');
UPDATE public.carriers SET active = true WHERE id = :'carrier_id';
SELECT pg_temp.check_true((SELECT active FROM public.carriers WHERE id = :'carrier_id'), 'admin reactivated carrier');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.price_change_notifications(new_price) VALUES(999);
    RAISE EXCEPTION 'FAIL: direct notification insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT id AS clean_carrier_id FROM public.create_carrier_with_services(
  '{"name":"No history","logo_url":"","supported_countries":["CZ"]}',
  '[{"name":"Clean service","shipment_type":"balik","price_per_unit":90}]') \gset
DELETE FROM public.carriers WHERE id = :'clean_carrier_id' RETURNING id;
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.carriers WHERE id = :'clean_carrier_id'), 'carrier without history deleted');
INSERT INTO public.products(code,name,image_url,items_per_box,items_per_pallet)
  VALUES('fixture','Test product','/test.png',11,22);
UPDATE public.products SET parcel_disabled = true WHERE code = 'fixture';
SELECT pg_temp.check_true((SELECT items_per_box = 11 FROM public.products WHERE code = 'fixture'), 'parcel disable preserves capacity');
UPDATE public.products SET parcel_disabled = false, pallet_disabled = true WHERE code = 'fixture';
UPDATE public.products SET pallet_disabled = false WHERE code = 'fixture';
SELECT pg_temp.check_true((SELECT items_per_box = 11 AND items_per_pallet = 22 FROM public.products WHERE code = 'fixture'), 'capacities preserved');
DO $$ BEGIN
  BEGIN
    PERFORM public.create_carrier_with_services(
      '{"name":"must roll back","supported_countries":["HU"]}',
      '[{"name":"valid","shipment_type":"balik","price_per_unit":100},{"name":"invalid","shipment_type":"invalid","price_per_unit":100}]');
    RAISE EXCEPTION 'FAIL: invalid service accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM pg_temp.check_true(NOT EXISTS(SELECT FROM public.carriers WHERE name = 'must roll back'), 'atomic carrier creation');
END $$;

-- Both ordinary authenticated and anon are denied all mutations.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.admin_profiles), 'nonadmin sees only own profile');
SELECT pg_temp.check_true((SELECT bool_and(id = auth.uid()) FROM public.admin_profiles), 'nonadmin cannot see admin profile');
DO $$ DECLARE t text; affected integer; BEGIN
  FOREACH t IN ARRAY ARRAY['products','carriers','services'] LOOP
    EXECUTE format('UPDATE public.%I SET name = %L', t, 'forbidden');
    GET DIAGNOSTICS affected = ROW_COUNT;
    PERFORM pg_temp.check_true(affected = 0, 'nonadmin update ' || t);
    EXECUTE format('DELETE FROM public.%I', t);
    GET DIAGNOSTICS affected = ROW_COUNT;
    PERFORM pg_temp.check_true(affected = 0, 'nonadmin delete ' || t);
  END LOOP;
  BEGIN
    INSERT INTO public.products(code,name,image_url,items_per_box,items_per_pallet) VALUES('bad','bad','bad',1,1);
    RAISE EXCEPTION 'FAIL: nonadmin product insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.carriers(name) VALUES('bad');
    RAISE EXCEPTION 'FAIL: nonadmin carrier insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.services(name,shipment_type,price_per_unit) VALUES('bad','balik',1);
    RAISE EXCEPTION 'FAIL: nonadmin service insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.create_carrier_with_services('{"name":"bad","supported_countries":["HU"]}', '[{"name":"bad","shipment_type":"balik","price_per_unit":1}]');
    RAISE EXCEPTION 'FAIL: nonadmin RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.admin_profiles SET is_super_admin = true WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL: nonadmin changed is_super_admin';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE public.carriers SET active = false WHERE id = :'carrier_id';
SELECT pg_temp.check_true((SELECT active FROM public.carriers WHERE id = :'carrier_id'), 'nonadmin cannot deactivate carrier');
SELECT set_config('test.carrier_id', :'carrier_id', false);
SET ROLE anon;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['products','carriers','services'] LOOP
    BEGIN
      EXECUTE format('UPDATE public.%I SET name = %L', t, 'forbidden');
      RAISE EXCEPTION 'FAIL: anon update';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      EXECUTE format('DELETE FROM public.%I', t);
      RAISE EXCEPTION 'FAIL: anon delete';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    PERFORM pg_temp.check_true(has_table_privilege(t, 'SELECT'), 'anon read');
    PERFORM pg_temp.check_true(NOT has_table_privilege(t, 'INSERT'), 'anon insert denied');
    PERFORM pg_temp.check_true(NOT has_table_privilege(t, 'TRUNCATE'), 'anon truncate denied');
  END LOOP;
  PERFORM pg_temp.check_true(NOT has_table_privilege('public.admin_profiles', 'SELECT'), 'anon profile read denied');
  PERFORM pg_temp.check_true(NOT has_table_privilege('public.admin_profiles', 'UPDATE'), 'anon profile update denied');
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.carriers SET active = false
      WHERE id = current_setting('test.carrier_id')::uuid;
    RAISE EXCEPTION 'FAIL: anon changed active state';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT pg_temp.check_true((SELECT price_per_unit = 235 FROM public.services WHERE id = :'service_id'), 'nonadmin did not change price');
DO $$ BEGIN
  BEGIN
    DELETE FROM public.services
      WHERE carrier_id = (SELECT id FROM public.carriers WHERE name = 'GLS HU');
    RAISE EXCEPTION 'FAIL: service with history deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    DELETE FROM public.carriers WHERE name = 'GLS HU';
    RAISE EXCEPTION 'FAIL: carrier with history deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
SELECT pg_temp.check_true(EXISTS(SELECT FROM public.carriers WHERE id = :'carrier_id'), 'carrier with history retained');
SELECT pg_temp.check_true(EXISTS(SELECT FROM public.services WHERE id = :'service_id'), 'service with history retained');
SELECT pg_temp.check_true(EXISTS(SELECT FROM public.price_change_notifications WHERE new_price = 234 AND carrier_id = :'carrier_id' AND service_id = :'service_id'), 'notification links retained');
DELETE FROM public.products WHERE code = 'fixture' RETURNING id;
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.products WHERE code = 'fixture'), 'product deleted');
SELECT 'PASS: admin CRUD, profile isolation, nonadmin denial, trigger, capacity, atomicity, protected history' AS result;
