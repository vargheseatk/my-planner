import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { StoreProvider, useStore } from './store'
import { Today } from './views/Today'
import { Tracks } from './views/Tracks'
import { Inbox } from './views/Inbox'
import { Timeline } from './views/Timeline'
import { Principles } from './views/Principles'
import { Settings } from './views/Settings'
import { Login } from './views/Login'
import { Icon, type IconName } from './components/icons'
import { Sheet, UICtx, openTasks, sortedTracks, type CaptureDefaults } from './components/ui'
import { TaskDetail } from './components/TaskDetail'
import { Capture } from './components/Capture'
import { VIEWS, go, type View } from './nav'

const META: Record<View, { label: string; icon: IconName }> = {
  today: { label: 'Today', icon: 'today' },
  tracks: { label: 'Tracks', icon: 'tracks' },
  ideas: { label: 'Ideas', icon: 'ideas' },
  timeline: { label: 'Timeline', icon: 'timeline' },
  principles: { label: 'Principles', icon: 'principles' },
  settings: { label: 'Settings', icon: 'settings' },
}

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
  const { data, loading, error, clearError } = useStore()
  const [route, setRoute] = useState(readHash)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [capture, setCapture] = useState<CaptureDefaults | null>(null)

  useEffect(() => {
    const on = () => {
      setRoute(readHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  // "n" opens capture from anywhere (when not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !t.closest('input, textarea, select, [contenteditable]')) {
        e.preventDefault()
        setCapture({})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ui = useMemo(() => ({ openTask: setTaskId, openCapture: (d: CaptureDefaults = {}) => setCapture(d) }), [])
  const closeTask = useCallback(() => setTaskId(null), [])
  const closeCapture = useCallback(() => setCapture(null), [])
  const task = data.tasks.find((t) => t.id === taskId)
  const taskTrack = data.tracks.find((t) => t.id === task?.track_id)
  const inbox = data.ideas.filter((i) => i.status === 'inbox').length
  const open = openTasks(data.tasks)
  const tracks = sortedTracks(data.tracks).filter((t) => t.status !== 'done')

  return (
    <UICtx.Provider value={ui}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark" />
            Planner
          </div>
          <button className="capture-btn" onClick={() => setCapture({})}>
            <Icon name="plus" size={18} /> Capture <kbd>N</kbd>
          </button>
          <nav className="side-nav">
            {(['today', 'timeline', 'ideas', 'principles'] as View[]).map((v) => (
              <button key={v} className={route.view === v ? 'on' : ''} onClick={() => go(v)}>
                <Icon name={META[v].icon} />
                {META[v].label}
                {v === 'ideas' && inbox > 0 && <span className="badge">{inbox}</span>}
              </button>
            ))}
          </nav>
          <div className="side-label">
            <button className={route.view === 'tracks' && !route.id ? 'on' : ''} onClick={() => go('tracks')}>
              Tracks
            </button>
          </div>
          <nav className="side-tracks">
            {tracks.map((t) => (
              <button key={t.id} className={`${route.view === 'tracks' && route.id === t.id ? 'on' : ''} s-${t.status}`} style={{ '--c': t.color } as React.CSSProperties} onClick={() => go('tracks', t.id)}>
                <span className="dot" />
                <span className="name">{t.name}</span>
                <span className="n">{open.filter((x) => x.track_id === t.id).length || ''}</span>
              </button>
            ))}
          </nav>
          <div className="side-foot">
            <button className={route.view === 'settings' ? 'on' : ''} onClick={() => go('settings')}>
              <Icon name="settings" size={18} />
              Settings
            </button>
          </div>
        </aside>

        <header className="topbar">
          <span className="brand">
            <span className="brand-mark" />
            {route.view === 'tracks' && route.id ? data.tracks.find((t) => t.id === route.id)?.name ?? 'Track' : META[route.view].label}
          </span>
          <button className={`icon-btn ${route.view === 'principles' ? 'on' : ''}`} aria-label="Principles" onClick={() => go('principles')}>
            <Icon name="principles" />
          </button>
          <button className={`icon-btn ${route.view === 'settings' ? 'on' : ''}`} aria-label="Settings" onClick={() => go('settings')}>
            <Icon name="settings" />
          </button>
        </header>

        <main className="main">
          {error && (
            <div className="error-bar" onClick={clearError}>
              {error} <span>Tap to dismiss</span>
            </div>
          )}
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
          ) : route.view === 'principles' ? (
            <Principles />
          ) : (
            <Settings />
          )}
        </main>

        <nav className="tabbar">
          {(['today', 'tracks'] as View[]).map((v) => (
            <button key={v} className={route.view === v ? 'on' : ''} onClick={() => go(v)}>
              <Icon name={META[v].icon} />
              <span>{META[v].label}</span>
            </button>
          ))}
          <button className="fab" aria-label="Capture" onClick={() => setCapture({})}>
            <Icon name="plus" size={26} />
          </button>
          {(['ideas', 'timeline'] as View[]).map((v) => (
            <button key={v} className={route.view === v ? 'on' : ''} onClick={() => go(v)}>
              <Icon name={META[v].icon} />
              <span>{META[v].label}</span>
              {v === 'ideas' && inbox > 0 && <span className="badge">{inbox}</span>}
            </button>
          ))}
        </nav>

        <Sheet
          open={!!task}
          onClose={closeTask}
          title={
            taskTrack ? (
              <button className="sheet-crumb" style={{ '--c': taskTrack.color } as React.CSSProperties} onClick={() => (closeTask(), go('tracks', taskTrack.id))}>
                <span className="dot" />
                {taskTrack.name}
              </button>
            ) : (
              'Task'
            )
          }
        >
          {task && <TaskDetail key={task.id} task={task} onClose={closeTask} />}
        </Sheet>
        <Sheet open={!!capture} onClose={closeCapture} title="Capture">
          {capture && <Capture defaults={capture} onDone={closeCapture} />}
        </Sheet>
      </div>
    </UICtx.Provider>
  )
}
