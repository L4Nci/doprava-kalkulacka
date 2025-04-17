-- Přidáme nový sloupec
ALTER TABLE products ADD COLUMN items_per_pallet integer;

-- Přepočítáme hodnoty (převedeme desetinná čísla na počty kusů)
UPDATE products 
SET items_per_pallet = CEIL(1 / palette_percentage)
WHERE palette_percentage > 0;

-- Pro jistotu nastavíme výchozí hodnotu pro případy, kde by byl palette_percentage 0
UPDATE products 
SET items_per_pallet = 100 
WHERE items_per_pallet IS NULL OR items_per_pallet = 0;

-- Když máme data převedená, můžeme smazat starý sloupec
ALTER TABLE products DROP COLUMN palette_percentage;

-- Nastavíme nový sloupec jako povinný
ALTER TABLE products ALTER COLUMN items_per_pallet SET NOT NULL;
