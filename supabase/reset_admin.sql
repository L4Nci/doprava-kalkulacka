-- Odstranit tabulku a policies
DROP TABLE IF EXISTS public.admin_profiles;

-- Vytvořit novou admin tabulku
CREATE TABLE public.admin_profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Vložit admin účet
INSERT INTO public.admin_profiles (id, email, full_name, is_super_admin)
VALUES (
    'bb48fee1-a00c-49b5-b35f-bb19a843ebcc',
    'viktor@textilomanie.cz',
    'Viktor',
    true
);

-- Nastavit RLS
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Základní policy pro čtení
CREATE POLICY "allow_read_for_authenticated" ON public.admin_profiles
    FOR SELECT TO authenticated
    USING (true);

-- Policy pro úpravy pouze pro admina
CREATE POLICY "allow_admin_access" ON public.admin_profiles
    FOR ALL TO authenticated
    USING (auth.uid() = 'bb48fee1-a00c-49b5-b35f-bb19a843ebcc');
