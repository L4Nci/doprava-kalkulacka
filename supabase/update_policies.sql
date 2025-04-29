-- Odstranit existující policies
DROP POLICY IF EXISTS "Enable all access for admins" ON public.admin_profiles;

-- Přidat nové policies
CREATE POLICY "Allow public read for admin_profiles"
ON public.admin_profiles FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated users to read admin_profiles"
ON public.admin_profiles FOR SELECT
TO authenticated
USING (true);

-- Resetovat RLS
ALTER TABLE public.admin_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
