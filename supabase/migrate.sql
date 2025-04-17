-- Nejdřív vytvořme zálohu dat
CREATE TABLE products_backup AS SELECT * FROM products;

-- Smažeme původní tabulku
DROP TABLE products;

-- Vytvoříme novou tabulku s požadovanou strukturou
CREATE TABLE products (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique default uuid_generate_v4(),
  name text not null,
  items_per_box integer not null,
  items_per_pallet integer not null,
  image_url text not null
);

-- Vložíme data zpět s výchozí hodnotou pro items_per_pallet
INSERT INTO products (id, code, name, items_per_box, items_per_pallet, image_url)
SELECT 
  id, 
  code, 
  name, 
  items_per_box, 
  100, -- výchozí hodnota pro items_per_pallet
  image_url 
FROM products_backup;

-- Přidáme index
CREATE INDEX products_code_idx ON products(code);

-- Smažeme záložní tabulku
DROP TABLE products_backup;
