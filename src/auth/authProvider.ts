import { supabaseEnabled } from '../lib/supabase'

const rawClerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
const localDemoMode = import.meta.env.VITE_DEMETER_AUTH_MODE === 'demo'

export const clerkPublishableKey = localDemoMode || rawClerkPublishableKey?.includes('your-key-here')
  ? undefined
  : rawClerkPublishableKey

export type AuthProvider = 'supabase' | 'clerk' | 'demo'

// Resolution order: Supabase (if configured) -> Clerk (if configured) -> demo fallback.
export const authProvider: AuthProvider = localDemoMode
  ? 'demo'
  : supabaseEnabled
  ? 'supabase'
  : clerkPublishableKey
    ? 'clerk'
    : 'demo'
