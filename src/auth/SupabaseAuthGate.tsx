import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import App from '../App'
import { setAccessToken } from '../lib/apiClient'
import { supabase } from '../lib/supabase'
import { SupabaseLoginPage } from './SupabaseLoginPage'

export function SupabaseAuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return undefined
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAccessToken(data.session?.access_token ?? null)
      setReady(true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAccessToken(nextSession?.access_token ?? null)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return null
  }

  if (!session) {
    return <SupabaseLoginPage />
  }

  return <App authMode="supabase" onSignOut={() => void supabase?.auth.signOut()} />
}
