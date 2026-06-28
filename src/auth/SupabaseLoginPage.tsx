import { useState } from 'react'

import { WheatLogo } from '../components/WheatLogo'
import { supabase } from '../lib/supabase'

type OAuthProvider = 'google' | 'github'

export function SupabaseLoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined

  const signInWithOAuth = async (provider: OAuthProvider) => {
    if (!supabase) {
      return
    }

    setError(null)
    setBusy(true)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })

    if (oauthError) {
      setError(oauthError.message)
      setBusy(false)
    }
  }

  const sendMagicLink = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!supabase || !email.trim()) {
      return
    }

    setError(null)
    setStatus(null)
    setBusy(true)

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    })

    setBusy(false)

    if (otpError) {
      setError(otpError.message)
      return
    }

    setStatus(`Magic link sent to ${email.trim()}. Check your inbox.`)
  }

  return (
    <main className="demo-entry">
      <section className="demo-entry-panel auth-panel">
        <div className="demo-brand">
          <span>
            <WheatLogo size={26} />
          </span>
          <b>Demeter</b>
        </div>

        <div className="demo-copy">
          <p>Farm workspace</p>
          <h1>Log in to Demeter</h1>
        </div>

        <div className="oauth-stack">
          <button type="button" className="oauth-button" disabled={busy} onClick={() => signInWithOAuth('google')}>
            Continue with Google
          </button>
          <button type="button" className="oauth-button" disabled={busy} onClick={() => signInWithOAuth('github')}>
            Continue with GitHub
          </button>
        </div>

        <div className="auth-divider">
          <span>or email magic link</span>
        </div>

        <form className="demo-login-form" onSubmit={sendMagicLink}>
          <label className="demo-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@farm.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <button className="demo-login-button" type="submit" disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Send magic link'}
          </button>
        </form>

        {status && <p className="auth-message success">{status}</p>}
        {error && <p className="auth-message error">{error}</p>}
      </section>
    </main>
  )
}
