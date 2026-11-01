import { useState } from 'react'
import { OWNER_EMAIL } from '../config'
import { supabase } from '../supabase'

// Password only: the email is fixed to the single owner account.
// "Email me a code" is the fallback if the password is forgotten.
export function Login() {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<'password' | 'code'>('password')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const run = async (fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(true)
    setMsg(null)
    const { error } = await fn()
    setBusy(false)
    if (error) setMsg(error.message)
    return !error
  }

  const signIn = () => run(() => supabase.auth.signInWithPassword({ email: OWNER_EMAIL, password }))

  const sendCode = async () => {
    const ok = await run(() =>
      supabase.auth.signInWithOtp({
        email: OWNER_EMAIL,
        options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname },
      }),
    )
    if (ok) setSent(true)
  }

  const verify = () => run(() => supabase.auth.verifyOtp({ email: OWNER_EMAIL, token: code.trim(), type: 'email' }))

  return (
    <div className="login">
      <span className="brand-mark big" />
      <h1>My Planner</h1>
      <p className="lede">Plan the day. Keep the tracks moving.</p>
      {mode === 'password' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            signIn()
          }}
        >
          <input
            className="boxed"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn primary" disabled={busy || !password}>
            Sign in
          </button>
          <button type="button" className="link" onClick={() => setMode('code')}>
            Forgot password? Email me a code
          </button>
          {msg && <p className="error">{msg}</p>}
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (sent) verify()
            else sendCode()
          }}
        >
          {!sent ? (
            <button className="btn primary" disabled={busy}>
              Send a sign-in code to my email
            </button>
          ) : (
            <>
              <p className="sub">Check your email for a code (or tap the link in it).</p>
              <input className="boxed code" inputMode="numeric" autoComplete="one-time-code" placeholder="Code from email" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn primary" disabled={busy || code.trim().length < 6}>
                Sign in
              </button>
            </>
          )}
          <button type="button" className="link" onClick={() => setMode('password')}>
            Back to password
          </button>
          {msg && <p className="error">{msg}</p>}
        </form>
      )}
    </div>
  )
}
