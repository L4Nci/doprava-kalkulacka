-- Automatické mazání starých notifikací (starších než 3 měsíce)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM price_change_notifications 
  WHERE created_at < NOW() - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql;

-- Naplánování úklidu (spustí se každý den ve 3:00)
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 3 * * *',
  'SELECT cleanup_old_notifications()'
);
