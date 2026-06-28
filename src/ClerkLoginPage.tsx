import { SignIn } from '@clerk/clerk-react'

export function ClerkLoginPage() {
  return (
    <main className="demo-entry">
      <section className="demo-entry-panel auth-panel">
        <div className="demo-brand">
          <span>D</span>
          <b>Demeter</b>
        </div>
        <div className="demo-copy">
          <p>Farm workspace</p>
          <h1>Log in to Demeter</h1>
        </div>
        <SignIn routing="hash" signUpUrl="#/sign-up" />
      </section>
    </main>
  )
}
