-- Odstranit všechny existující policies
DROP POLICY IF EXISTS "admin_read_policy" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_write_policy" ON public.admin_profiles;
DROP POLICY IF EXISTS "Allow admin access" ON public.admin_profiles;
DROP POLICY IF EXISTS "Enable all access for admins" ON public.admin_profiles;
DROP POLICY IF EXISTS "Allow public read for admin_profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read admin_profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "universal_admin_policy" ON public.admin_profiles;

-- Kompletně vyčistit RLS
ALTER TABLE public.admin_profiles DISABLE ROW LEVEL SECURITY;

-- Kompletně vyčistit tabulku a znovu vložit admin záznam
TRUNCATE public.admin_profiles;

-- Vložit váš admin záznam
INSERT INTO public.admin_profiles (id, email, full_name, is_super_admin)
VALUES (
    'bb48fee1-a00c-49b5-b35f-bb19a843ebcc',
    'viktor@textilomanie.cz',
    'Viktor',
    true
);

-- Vytvořit JEDNU univerzální policy
CREATE POLICY "universal_admin_policy" ON public.admin_profiles
    FOR ALL
    USING (true)
    WITH CHECK (auth.uid() = 'bb48fee1-a00c-49b5-b35f-bb19a843ebcc');

-- Zapnout RLS
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Ověřit nastavení
SELECT * FROM public.admin_profiles;
