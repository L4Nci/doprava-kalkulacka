ALTER TABLE products 
  ALTER COLUMN code SET DEFAULT gen_random_uuid();
