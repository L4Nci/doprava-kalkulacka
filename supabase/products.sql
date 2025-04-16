-- Nejdřív vytvoříme tabulku
create table products (
  id uuid default uuid_generate_v4() primary key,  -- Automatické generování UUID
  code uuid default uuid_generate_v4(),            -- Unikátní UUID pro kód produktu
  name text not null,
  items_per_box integer not null,
  palette_percentage decimal not null,
  image_url text not null
);

-- Zajistíme unikátnost kódu
alter table products add constraint products_code_key unique (code);

-- Vložíme všechny produkty
insert into products (code, name, items_per_box, palette_percentage, image_url) values
  ('polstar', 'Polštář', 10, 0.2, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/35707_polstar-economy-neprosity-70-x-90-cm.jpg?6201048e'),
  ('prikryvka', 'Přikrývka', 10, 1.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/4797_prikryvka-dute-vlakno-levna-140-x-200-cm-alergiky.jpg?5dace736'),
  ('set-prikryvka-polstar', 'Set přikrývky a polštáře', 6, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/47435-1_bed-set.jpg?6409b9bd'),
  ('set-detsky', 'Set přikrývky a polštáře do dětské postýlky', 10, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/2297-1_prikryvka-s-polstarem-dute-vlakno-levna-90-x-140-cm-alergiky-40-x-60-cm.png?5dace736'),
  ('povleceni', 'Povlečení', 30, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/10983-1_elegantni-bavlnene-povleceni-orient-sede-s-orientalnim-vzorem.jpg?5dace736'),
  ('prosteradlo-90', 'Prostěradlo 90x200', 40, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/35821-3_jersey-prosteradla-bile-13.jpg?6401028d'),
  ('prosteradlo-180', 'Prostěradlo 180x200', 30, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/35821-3_jersey-prosteradla-bile-13.jpg?6401028d'),
  ('rucnik', 'Ručník', 50, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/32040-1_hotelova-osuska-royal-bila-70x140-cm-z-100--bavlny-pro-luxusni-komfort.jpg?61a68868'),
  ('osuska', 'Osuška', 50, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/32040-1_hotelova-osuska-royal-bila-70x140-cm-z-100--bavlny-pro-luxusni-komfort.jpg?61a68868'),
  ('predlozka', 'Předložka', 50, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/31368-1_hotelova-predlozka-deluxe-50-x-70-cm-bila.jpg?610bc23e'),
  ('deky-prehozy', 'Deky a přehozy', 20, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/52541-4_tmave-sedy-prehoz-na-postel-leaves-s-elegantnim-listovym-vzorem.jpg?6527c547'),
  ('postel', 'Postel', 2, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/75992_stylova-postel-kalea-140-x-200-cm-z-masivni-borovice-s-prirodnim-vzhledem.png?678e45ae'),
  ('postel-rost', 'Postel + rošt', 3, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/75992_stylova-postel-kalea-140-x-200-cm-z-masivni-borovice-s-prirodnim-vzhledem.png?678e45ae'),
  ('postel-rost-matrace', 'Postel + rošt + matrace', 3, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/75992_stylova-postel-kalea-140-x-200-cm-z-masivni-borovice-s-prirodnim-vzhledem.png?678e45ae'),
  ('rost', 'Rošt', 4, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/12272-1_latkovy-rost.jpg?5dace736'),
  ('matrace', 'Matrace', 1, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/21590_somnia-17-cm.jpg?5f914d55'),
  ('zidle', 'Židle', 4, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/42537_tmave-seda-zidle-bali-mark-s-bukovymi-nohami.jpg?6347c700'),
  ('jednokus', 'Jednokus', 1, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/18878-1_mona-new-90-01-png-688x0-q85ss0-crop-replace-alpha-fff-jpg.png?65c4e49f'),
  ('chranic-matrace', 'Chránič matrace', 30, 0.01, 'https://cdn.myshoptet.com/usr/www.vyprodejpovleceni.cz/user/shop/big/5682_011-chranic-matrace-uvodni.jpg?62a0aaaf');

-- Přidáme indexy pro lepší výkon
create index products_code_idx on products(code);
