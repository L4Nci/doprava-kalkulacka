-- Nejdřív odstraníme existující trigger a funkci
DROP TRIGGER IF EXISTS track_price_changes ON services;
DROP FUNCTION IF EXISTS log_price_changes;

-- Vytvoříme novou verzi funkce s kontrolou časového intervalu
CREATE OR REPLACE FUNCTION log_price_changes()
RETURNS TRIGGER AS $$
DECLARE
  last_change timestamptz;
BEGIN
  -- Získáme čas poslední změny pro tento service
  SELECT created_at INTO last_change 
  FROM price_change_notifications 
  WHERE service_id = NEW.id 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- Vytvoříme notifikaci pouze pokud:
  -- 1. Cena se skutečně změnila
  -- 2. Od poslední změny uplynulo alespoň 5 sekund
  IF OLD.price_per_unit != NEW.price_per_unit 
     AND (last_change IS NULL OR NOW() - last_change > interval '5 seconds')
  THEN
    INSERT INTO price_change_notifications (
      carrier_id,
      service_id, 
      old_price,
      new_price
    ) VALUES (
      NEW.carrier_id,
      NEW.id,
      OLD.price_per_unit,
      NEW.price_per_unit
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vytvoříme nový trigger
CREATE TRIGGER track_price_changes
AFTER UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION log_price_changes();
