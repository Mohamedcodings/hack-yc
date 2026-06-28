import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { ClerkLoginPage } from './ClerkLoginPage.tsx'

const rawClerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
const clerkPublishableKey = rawClerkPublishableKey?.includes('your-key-here') ? undefined : rawClerkPublishableKey

const app = clerkPublishableKey ? (
  <ClerkProvider publishableKey={clerkPublishableKey}>
    <SignedOut>
      <ClerkLoginPage />
    </SignedOut>
    <SignedIn>
      <App authMode="clerk" />
    </SignedIn>
  </ClerkProvider>
) : (
  <App authMode="demo" />
)

createRoot(document.getElementById('root')!).render(<StrictMode>{app}</StrictMode>)
