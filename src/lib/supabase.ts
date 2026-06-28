import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function clean(value: string | undefined) {
  if (!value || value.includes('your-')) {
    return undefined
  }

  return value
}

export const supabaseUrl = clean(import.meta.env.VITE_SUPABASE_URL as string | undefined)
export const supabaseAnonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null
