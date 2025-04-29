-- Nejprve zkontrolujeme stav účtu
SELECT id, email, email_confirmed_at, last_sign_in_at 
FROM auth.users 
WHERE id = 'bb48fee1-a00c-49b5-b35f-bb19a843ebcc';

-- Nastavíme nové heslo a potvrdíme email
UPDATE auth.users
SET 
    raw_user_meta_data = '{"provider": "email"}',
    email_confirmed_at = now(),
    encrypted_password = crypt('hovno', gen_salt('bf'))
WHERE id = 'bb48fee1-a00c-49b5-b35f-bb19a843ebcc';

-- Vyčistíme nepotřebnou tabulku
DROP TABLE IF EXISTS public.profiles;
