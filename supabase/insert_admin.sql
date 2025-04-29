-- Vytvoření záznamu v admin_profiles pro existujícího uživatele
INSERT INTO public.admin_profiles (id, email, full_name, is_super_admin)
VALUES (
    'bb48fee1-a00c-49b5-b35f-bb19a843ebcc',  -- vaše UUID
    'viktor@textilomanie.cz',                 -- váš email
    'Viktor',                                 -- vaše jméno
    true                                      -- super admin práva
);
