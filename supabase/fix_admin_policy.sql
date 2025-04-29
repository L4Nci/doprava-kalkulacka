-- Odstranit všechny existující policies
DROP POLICY IF EXISTS "Allow admin access" ON public.admin_profiles;
DROP POLICY IF EXISTS "Enable all access for admins" ON public.admin_profiles;
DROP POLICY IF EXISTS "Allow public read for admin_profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read admin_profiles" ON public.admin_profiles;

-- Vypnout RLS
ALTER TABLE public.admin_profiles DISABLE ROW LEVEL SECURITY;

-- Vyčistit a znovu vložit váš admin záznam
DELETE FROM public.admin_profiles;
INSERT INTO public.admin_profiles (id, email, full_name, is_super_admin)
VALUES (
    'bb48fee1-a00c-49b5-b35f-bb19a843ebcc',
    'viktor@textilomanie.cz',
    'Viktor',
    true
);

-- Vytvořit jednoduchou policy bez rekurze
CREATE POLICY "admin_read_policy" ON public.admin_profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "admin_write_policy" ON public.admin_profiles
    FOR ALL TO authenticated
    USING (auth.uid() = 'bb48fee1-a00c-49b5-b35f-bb19a843ebcc');

-- Zapnout RLS
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
