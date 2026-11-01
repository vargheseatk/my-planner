import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { StoreProvider, useStore } from './store'
import { Today } from './views/Today'
import { Tracks } from './views/Tracks'
import { Inbox } from './views/Inbox'
import { Timeline } from './views/Timeline'
import { Principles } from './views/Principles'
import { Login } from './views/Login'

const VIEWS = ['today', 'tracks', 'ideas', 'timeline', 'principles'] as const
type View = (typeof VIEWS)[number]
const LABELS: Record<View, string> = { today: 'Today', tracks: 'Tracks', ideas: 'Ideas', timeline: 'Timeline', principles: 'Principles' }

// Hash route: #today, #tracks, #tracks/<id>, #ideas … Anything else (e.g. an auth callback) falls back to today.
function readHash(): { view: View; id: string | null } {
  const [v, id] = location.hash.slice(1).split('/')
  return VIEWS.includes(v as View) ? { view: v as View, id: id ?? null } : { view: 'today', id: null }
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const { data, loading, error, clearError, insert } = useStore()
  const [route, setRoute] = useState(readHash)
  const [capture, setCapture] = useState('')

  useEffect(() => {
    const on = () => setRoute(readHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const go = (view: View, id: string | null = null) => {
    location.hash = id ? `${view}/${id}` : view
  }
  const inbox = data.ideas.filter((i) => i.status === 'inbox').length

  return (
    <div className="shell">
      <nav className="nav">
        <span className="brand">Planner</span>
        {VIEWS.map((v) => (
          <button key={v} className={route.view === v ? 'on' : ''} onClick={() => go(v)}>
            {LABELS[v]}
            {v === 'ideas' && inbox > 0 && <span className="badge">{inbox}</span>}
          </button>
        ))}
        <button className="link signout" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </nav>

      <form
        className="capture"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!capture.trim()) return
          await insert('ideas', { body: capture.trim() })
          setCapture('')
        }}
      >
        <input className="edit" placeholder="Capture anything… (Enter to send to Ideas)" value={capture} onChange={(e) => setCapture(e.target.value)} />
      </form>

      {error && (
        <div className="error-bar" onClick={clearError}>
          {error} <span>(tap to dismiss)</span>
        </div>
      )}

      <main>
        {loading ? (
          <p className="empty">Loading…</p>
        ) : route.view === 'today' ? (
          <Today />
        ) : route.view === 'tracks' ? (
          <Tracks selected={route.id} onSelect={(id) => go('tracks', id)} />
        ) : route.view === 'ideas' ? (
          <Inbox />
        ) : route.view === 'timeline' ? (
          <Timeline />
        ) : (
          <Principles />
        )}
      </main>
    </div>
  )
}
