-- Vytvoření admin_profiles tabulky pokud neexistuje
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    is_super_admin BOOLEAN DEFAULT FALSE
);

-- Vložení vašeho admin záznamu
INSERT INTO public.admin_profiles (id, email, full_name, is_super_admin)
VALUES (
    'bb48fee1-a00c-49b5-b35f-bb19a843ebcc',  -- vaše UUID
    'viktor@textilomanie.cz',                 -- váš email
    'Viktor',                                 -- vaše jméno
    true                                      -- super admin práva
)
ON CONFLICT (id) DO UPDATE 
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    is_super_admin = EXCLUDED.is_super_admin;

-- Nastavení Row Level Security (RLS)
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Vytvoření policy pro přístup
CREATE POLICY "Enable all access for admins" ON public.admin_profiles
    USING (auth.uid() IN (SELECT id FROM public.admin_profiles));
