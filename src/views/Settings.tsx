import { useState } from 'react'
import { OWNER_EMAIL } from '../config'
import { supabase } from '../supabase'
import { Icon } from '../components/icons'

export function Settings() {
  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="lede">Signed in as {OWNER_EMAIL}</p>
      </header>
      <PasswordForm />
      <section className="card">
        <h3>Sign out</h3>
        <p className="muted">You'll need your password (or an email code) to get back in.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          <Icon name="logout" size={16} /> Sign out
        </button>
      </section>
    </div>
  )
}

function PasswordForm() {
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const mismatch = again.length > 0 && pw !== again

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setMsg({ ok: false, text: error.message })
    else {
      setMsg({ ok: true, text: 'Password saved. Use it to sign in from now on.' })
      setPw('')
      setAgain('')
    }
  }

  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (pw.length >= 8 && !mismatch) save()
      }}
    >
      <h3>Password</h3>
      <p className="muted">At least 8 characters. Use one you don't use anywhere else.</p>
      <input className="boxed" type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <input className="boxed" type="password" autoComplete="new-password" placeholder="Repeat it" value={again} onChange={(e) => setAgain(e.target.value)} />
      {mismatch && <p className="error">Passwords don't match.</p>}
      {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
      <div>
        <button className="btn primary" disabled={busy || pw.length < 8 || pw !== again}>
          Save password
        </button>
      </div>
    </form>
  )
}
