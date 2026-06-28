import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { config } from './config.js'

// Verify Supabase access tokens server-side via the Auth API (works for both the legacy
// HS256 shared-secret projects and the newer asymmetric signing keys — no secret juggling).
const supabaseAuthClient: SupabaseClient | null =
  config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null

export const supabaseConfigured = Boolean(supabaseAuthClient)

export function extractBearerToken(header: string | undefined) {
  if (!header) {
    return null
  }

  const match = header.match(/^Bearer\s+(.+)$/i)

  return match ? match[1] : null
}

export async function getSupabaseUser(token: string) {
  if (!supabaseAuthClient) {
    return null
  }

  try {
    const { data, error } = await supabaseAuthClient.auth.getUser(token)

    if (error || !data.user) {
      return null
    }

    return data.user
  } catch {
    return null
  }
}
