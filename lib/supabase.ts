import { createClient } from '@supabase/supabase-js'

const cleanEnvValue = (value: unknown) => {
  if (typeof value !== 'string') return ''
  const firstLine = value.split(/\r?\n/).map(line => line.trim()).find(Boolean) || ''
  return firstLine.replace(/^['"]|['"]$/g, '').trim()
}

// No built-in fallback: the app only talks to the database named in .env / Vercel settings.
// Without them it reports "Database not connected" instead of writing to some other shop's project.
const DEFAULT_SUPABASE_URL = 'https://placeholder.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'placeholder-key'

const supabaseUrl = cleanEnvValue(
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL
) || DEFAULT_SUPABASE_URL

const supabaseAnonKey = cleanEnvValue(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY
) || DEFAULT_SUPABASE_ANON_KEY

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)

export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== 'placeholder-key'
