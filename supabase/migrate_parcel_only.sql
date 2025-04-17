-- Přidáme nový sloupec do tabulky products
ALTER TABLE products 
ADD COLUMN parcel_disabled boolean DEFAULT false;
