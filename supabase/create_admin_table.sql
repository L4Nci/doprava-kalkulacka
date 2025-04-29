-- Odstranění existující tabulky (pokud existuje)
DROP TABLE IF EXISTS public.admin_profiles;

-- Vytvoření tabulky pro admin uživatele
CREATE TABLE public.admin_profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (id)
);

-- RLS Policies
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Admin může vidět všechny admin profily
CREATE POLICY "Admins can view all profiles" 
    ON public.admin_profiles FOR SELECT 
    TO authenticated
    USING (true);

-- Super admin může upravovat admin profily
CREATE POLICY "Super admins can update profiles" 
    ON public.admin_profiles FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_profiles ap 
            WHERE ap.id = auth.uid() AND ap.is_super_admin = true
        )
    );
