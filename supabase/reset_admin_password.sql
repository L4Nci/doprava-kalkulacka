-- Reset hesla pro konkrétního uživatele
UPDATE auth.users
SET encrypted_password = crypt('VaseNoveHeslo123', gen_salt('bf'))
WHERE id = 'bb48fee1-a00c-49b5-b35f-bb19a843ebcc';
