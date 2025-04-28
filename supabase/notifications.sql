-- Tabulka pro ukládání změn cen
CREATE TABLE price_change_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  carrier_id UUID REFERENCES carriers(id),
  service_id UUID REFERENCES services(id), 
  old_price DECIMAL,
  new_price DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- Přidání sloupce pro označení přečtených notifikací
ALTER TABLE price_change_notifications 
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- Index pro rychlejší filtrování nepřečtených
CREATE INDEX IF NOT EXISTS idx_notifications_read 
ON price_change_notifications(read);

-- Trigger pro sledování změn
CREATE OR REPLACE FUNCTION log_price_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price_per_unit != NEW.price_per_unit THEN
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

CREATE TRIGGER track_price_changes
AFTER UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION log_price_changes();
