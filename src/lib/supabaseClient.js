import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validace prostředí
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Check your .env file.')
}

// Globální instance
let supabaseInstance = null

// Singleton pattern
const createSupabaseClient = () => {
  if (supabaseInstance) {
    return supabaseInstance
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storageKey: 'doprava-app-auth', // Unikátní klíč pro storage
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  })

  if (import.meta.env.DEV) {
    console.log('🔌 Supabase initialized')
  }

  return supabaseInstance
}

export const supabase = createSupabaseClient()
