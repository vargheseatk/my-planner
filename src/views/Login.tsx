import { useState } from 'react'
import { supabase } from '../supabase'

// Email one-time code. shouldCreateUser is false, so only the account that
// already exists in Supabase can sign in.
export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const send = async () => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname },
    })
    setBusy(false)
    if (error) setMsg(error.message)
    else setSent(true)
  }

  const verify = async () => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setMsg(error.message)
  }

  return (
    <div className="login">
      <h1>My Planner</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (sent) verify()
          else send()
        }}
      >
        {!sent ? (
          <>
            <input className="edit" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button className="btn primary" disabled={busy || !email}>
              Send code
            </button>
          </>
        ) : (
          <>
            <p className="sub">Check {email} for a code (or tap the link in the email).</p>
            <input className="edit code" inputMode="numeric" autoComplete="one-time-code" placeholder="Code from email" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn primary" disabled={busy || code.trim().length < 6}>
              Sign in
            </button>
            <button type="button" className="link" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </>
        )}
        {msg && <p className="error">{msg}</p>}
      </form>
    </div>
  )
}
