import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { StoreProvider, useStore } from './store'
import { TasksPanel } from './views/Tasks'
import { Deadlines } from './views/Deadlines'
import { Errands } from './views/Errands'
import { NewTrack, TrackDetails } from './views/Tracks'
import { Inbox } from './views/Inbox'
import { Principles } from './views/Principles'
import { Settings } from './views/Settings'
import { Login } from './views/Login'
import { Icon } from './components/icons'
import { AREAS, Sheet, UICtx, openTasks, sortedTracks, type CaptureDefaults } from './components/ui'
import { TaskDetail } from './components/TaskDetail'
import { Capture } from './components/Capture'
import { goPage, goTrack, readHash } from './nav'

// On phones the board shows one panel at a time; on wide screens all three sit side by side.
type Panel = 'tasks' | 'deadlines' | 'errands'

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
  const [panel, setPanel] = useState<Panel>('tasks')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [capture, setCapture] = useState<CaptureDefaults | null>(null)
  // Track sheet: a track id for its details, 'new' to create one.
  const [trackSheet, setTrackSheet] = useState<string | null>(null)

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

  const trackId = route.page === 'board' ? route.trackId : null
  const ui = useMemo(
    () => ({
      openTask: setTaskId,
      openCapture: (d: CaptureDefaults = {}) => setCapture(d),
      openTrack: (id: string | null) => setTrackSheet(id ?? 'new'),
    }),
    [],
  )
  const closeTask = useCallback(() => setTaskId(null), [])
  const closeCapture = useCallback(() => setCapture(null), [])
  const closeTrack = useCallback(() => setTrackSheet(null), [])
  const task = data.tasks.find((t) => t.id === taskId)
  const taskTrack = data.tracks.find((t) => t.id === task?.track_id)
  const sheetTrack = data.tracks.find((t) => t.id === trackSheet)
  const inbox = data.ideas.filter((i) => i.status === 'inbox').length
  const errands = openTasks(data.tasks).filter((t) => !t.track_id).length
  const showPanel = (p: Panel) => {
    setPanel(p)
    if (route.page !== 'board') goTrack(null)
    window.scrollTo(0, 0)
  }

  return (
    <UICtx.Provider value={ui}>
      <div className="app">
        <header className="top">
          <div className="top-row">
            <button className="brand" onClick={() => goTrack(null)}>
              <span className="brand-mark" />
              Planner
            </button>
            <span className="spacer" />
            <button className="capture-btn" onClick={() => setCapture({ trackId })}>
              <Icon name="plus" size={16} /> Capture <kbd>N</kbd>
            </button>
            <button className={`icon-btn with-badge ${route.page === 'ideas' ? 'on' : ''}`} aria-label="Ideas" title="Ideas" onClick={() => goPage('ideas')}>
              <Icon name="ideas" />
              {inbox > 0 && <span className="badge">{inbox}</span>}
            </button>
            <button className={`icon-btn ${route.page === 'principles' ? 'on' : ''}`} aria-label="Principles" title="Principles" onClick={() => goPage('principles')}>
              <Icon name="principles" />
            </button>
            <button className={`icon-btn ${route.page === 'settings' ? 'on' : ''}`} aria-label="Settings" title="Settings" onClick={() => goPage('settings')}>
              <Icon name="settings" />
            </button>
          </div>
          <TrackBar current={route.page === 'board' ? trackId : undefined} onNew={() => setTrackSheet('new')} />
        </header>

        <main className="main">
          {error && (
            <div className="error-bar" onClick={clearError}>
              {error} <span>Tap to dismiss</span>
            </div>
          )}
          {loading ? (
            <p className="empty">Loading…</p>
          ) : route.page === 'board' ? (
            <div className={`board show-${panel}`}>
              <TasksPanel trackId={trackId} />
              <Deadlines trackId={trackId} />
              <Errands />
            </div>
          ) : route.page === 'ideas' ? (
            <Inbox />
          ) : route.page === 'principles' ? (
            <Principles />
          ) : (
            <Settings />
          )}
        </main>

        <nav className="tabbar">
          <button className={route.page === 'board' && panel === 'tasks' ? 'on' : ''} onClick={() => showPanel('tasks')}>
            <Icon name="list" />
            <span>Tasks</span>
          </button>
          <button className={route.page === 'board' && panel === 'deadlines' ? 'on' : ''} onClick={() => showPanel('deadlines')}>
            <Icon name="timeline" />
            <span>Deadlines</span>
          </button>
          <button className="fab" aria-label="Capture" onClick={() => setCapture({ trackId })}>
            <Icon name="plus" size={26} />
          </button>
          <button className={route.page === 'board' && panel === 'errands' ? 'on' : ''} onClick={() => showPanel('errands')}>
            <Icon name="check" />
            <span>Errands</span>
            {errands > 0 && <span className="badge">{errands}</span>}
          </button>
          <button className={route.page === 'ideas' ? 'on' : ''} onClick={() => goPage('ideas')}>
            <Icon name="ideas" />
            <span>Ideas</span>
            {inbox > 0 && <span className="badge">{inbox}</span>}
          </button>
        </nav>

        <Sheet
          open={!!task}
          onClose={closeTask}
          title={
            taskTrack ? (
              <button className="sheet-crumb" style={{ '--c': taskTrack.color } as React.CSSProperties} onClick={() => (closeTask(), goTrack(taskTrack.id))}>
                <span className="dot" />
                {taskTrack.name}
              </button>
            ) : (
              'Errand'
            )
          }
        >
          {task && <TaskDetail key={task.id} task={task} onClose={closeTask} />}
        </Sheet>
        <Sheet open={!!capture} onClose={closeCapture} title="Capture">
          {capture && <Capture defaults={capture} onDone={closeCapture} />}
        </Sheet>
        <Sheet open={trackSheet !== null} onClose={closeTrack} title={trackSheet === 'new' ? 'New track' : 'Track details'}>
          {trackSheet === 'new' ? <NewTrack onDone={closeTrack} /> : sheetTrack && <TrackDetails key={sheetTrack.id} track={sheetTrack} />}
        </Sheet>
      </div>
    </UICtx.Provider>
  )
}

// Tracks across the top, grouped by area. current: selected track id, null = overview, undefined = another page.
function TrackBar({ current, onNew }: { current: string | null | undefined; onNew: () => void }) {
  const { data } = useStore()
  const tracks = sortedTracks(data.tracks).filter((t) => t.status !== 'done')
  const open = openTasks(data.tasks)
  return (
    <nav className="trackbar" aria-label="Tracks">
      <button className={`tb-pill tb-home ${current === null ? 'on' : ''}`} onClick={() => goTrack(null)}>
        Overview
      </button>
      {AREAS.map(({ area, label }) => {
        const list = tracks.filter((t) => t.area === area)
        if (!list.length) return null
        return (
          <div key={area} className="tb-group">
            <span className="tb-label">{label}</span>
            {list.map((t) => {
              const n = open.filter((x) => x.track_id === t.id && x.lane === 'now').length
              return (
                <button key={t.id} className={`tb-pill s-${t.status} ${current === t.id ? 'on' : ''}`} style={{ '--c': t.color } as React.CSSProperties} onClick={() => goTrack(t.id)}>
                  <span className="dot" />
                  {t.name}
                  {n > 0 && <span className="n">{n}</span>}
                </button>
              )
            })}
          </div>
        )
      })}
      <button className="tb-pill tb-add" aria-label="New track" title="New track" onClick={onNew}>
        <Icon name="plus" size={14} />
      </button>
    </nav>
  )
}
