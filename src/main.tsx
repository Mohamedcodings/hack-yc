import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { ClerkLoginPage } from './ClerkLoginPage.tsx'
import { SupabaseAuthGate } from './auth/SupabaseAuthGate.tsx'
import { authProvider, clerkPublishableKey } from './auth/authProvider.ts'

let app: React.ReactNode

if (authProvider === 'supabase') {
  app = <SupabaseAuthGate />
} else if (authProvider === 'clerk' && clerkPublishableKey) {
  app = (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <SignedOut>
        <ClerkLoginPage />
      </SignedOut>
      <SignedIn>
        <App authMode="clerk" />
      </SignedIn>
    </ClerkProvider>
  )
} else {
  app = <App authMode="demo" />
}

createRoot(document.getElementById('root')!).render(<StrictMode>{app}</StrictMode>)
