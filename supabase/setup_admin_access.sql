-- Vyčistit všechny existující policies
DROP POLICY IF EXISTS "admin_read" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_insert" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_update" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_delete" ON public.admin_profiles;

-- Reset tabulky
TRUNCATE public.admin_profiles;

-- Vložit admin účet
INSERT INTO public.admin_profiles (id, email, full_name, is_super_admin)
VALUES (
    'bb48fee1-a00c-49b5-b35f-bb19a843ebcc',
    'viktor@textilomanie.cz',
    'Viktor',
    true
);

-- Nastavit základní přístup
ALTER TABLE public.admin_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Jednoduchá policy pro plný přístup admina
CREATE POLICY "full_access_for_admin" ON public.admin_profiles
    FOR ALL
    TO authenticated
    USING (
        email = 'viktor@textilomanie.cz'
        AND
        auth.uid() = 'bb48fee1-a00c-49b5-b35f-bb19a843ebcc'
    );

-- Pro kontrolu
SELECT * FROM public.admin_profiles;
