import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { StoreProvider, useStore } from './store'
import { TasksPanel } from './views/Tasks'
import { Deadlines } from './views/Deadlines'
import { Errands } from './views/Errands'
import { Reach } from './views/Reach'
import { Habits, activeHabits } from './views/Habits'
import { todayIso } from './dates'
import { NewTrack, TrackDetails } from './views/Tracks'
import { Inbox } from './views/Inbox'
import { Principles } from './views/Principles'
import { Self } from './views/Self'
import { Settings } from './views/Settings'
import { Login } from './views/Login'
import { Icon } from './components/icons'
import { AREAS, Menu, Sheet, UICtx, openTasks, sortedTracks, type CaptureDefaults } from './components/ui'
import type { Track } from './types'
import { TaskDetail } from './components/TaskDetail'
import { Capture } from './components/Capture'
import { goPage, goTrack, readHash } from './nav'

// The board shows one view at a time: header tabs on wide screens, bottom tabs on phones.
type Panel = 'tasks' | 'habits' | 'deadlines' | 'errands' | 'reach'
const VIEWS: { panel: Panel; label: string }[] = [
  { panel: 'tasks', label: 'Tasks' },
  { panel: 'habits', label: 'Habits' },
  { panel: 'deadlines', label: 'Deadlines' },
  { panel: 'errands', label: 'Errands' },
  { panel: 'reach', label: 'Reach out' },
]

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
  const toSend = data.outreach.filter((o) => o.status === 'draft').length
  const today = todayIso()
  const habitsLeft = activeHabits(data.habits).filter((h) => !data.habit_logs.some((l) => l.habit_id === h.id && l.day === today)).length
  const showPanel = (p: Panel) => {
    setPanel(p)
    if (route.page !== 'board') goTrack(null)
    window.scrollTo(0, 0)
  }

  return (
    <UICtx.Provider value={ui}>
      <div className="app">
        <header className="top">
          <button className="brand" aria-label="Overview" onClick={() => goTrack(null)}>
            <span className="brand-mark" />
          </button>
          <TrackMenu current={route.page === 'board' ? trackId : undefined} onNew={() => setTrackSheet('new')} />
          <span className="spacer" />
          <div className="view-seg" role="tablist">
            {VIEWS.map((v) => (
              <button key={v.panel} role="tab" aria-selected={route.page === 'board' && panel === v.panel} className={route.page === 'board' && panel === v.panel ? 'on' : ''} onClick={() => showPanel(v.panel)}>
                {v.label}
                {v.panel === 'errands' && errands > 0 && <span className="n">{errands}</span>}
                {v.panel === 'habits' && habitsLeft > 0 && <span className="n">{habitsLeft}</span>}
                {v.panel === 'reach' && toSend > 0 && <span className="n">{toSend}</span>}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <button className="btn small primary capture-btn" onClick={() => setCapture({ trackId })} title="Capture (N)">
            <Icon name="plus" size={16} /> Capture
          </button>
          <Menu
            align="right"
            className={`icon-btn with-badge ${route.page !== 'board' ? 'on' : ''}`}
            label={
              <>
                <Icon name="more" />
                {inbox > 0 && <span className="badge">{inbox}</span>}
              </>
            }
          >
            {(close) => (
              <>
                {(
                  [
                    ['ideas', 'Ideas', 'ideas'],
                    ['self', 'Know myself', 'self'],
                    ['principles', 'Principles', 'principles'],
                    ['settings', 'Settings', 'settings'],
                  ] as const
                ).map(([page, label, icon]) => (
                  <button key={page} role="menuitem" className={route.page === page ? 'on' : ''} onClick={() => (close(), goPage(page))}>
                    <Icon name={icon} size={18} />
                    {label}
                    {page === 'ideas' && inbox > 0 && <span className="badge">{inbox}</span>}
                  </button>
                ))}
              </>
            )}
          </Menu>
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
              {panel === 'tasks' ? <TasksPanel trackId={trackId} /> : panel === 'deadlines' ? <Deadlines trackId={trackId} /> : panel === 'errands' ? <Errands /> : panel === 'habits' ? <Habits /> : <Reach />}
            </div>
          ) : route.page === 'ideas' ? (
            <Inbox />
          ) : route.page === 'self' ? (
            <Self />
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
          <button className={route.page === 'board' && panel === 'habits' ? 'on' : ''} onClick={() => showPanel('habits')}>
            <Icon name="check" />
            <span>Habits</span>
            {habitsLeft > 0 && <span className="badge">{habitsLeft}</span>}
          </button>
          <button className={route.page === 'board' && panel === 'deadlines' ? 'on' : ''} onClick={() => showPanel('deadlines')}>
            <Icon name="timeline" />
            <span>Deadlines</span>
          </button>
          <button className={route.page === 'board' && panel === 'errands' ? 'on' : ''} onClick={() => showPanel('errands')}>
            <Icon name="flag" />
            <span>Errands</span>
            {errands > 0 && <span className="badge">{errands}</span>}
          </button>
          <button className={route.page === 'board' && panel === 'reach' ? 'on' : ''} onClick={() => showPanel('reach')}>
            <Icon name="send" />
            <span>Reach out</span>
            {toSend > 0 && <span className="badge">{toSend}</span>}
          </button>
        </nav>
        <button className="fab" aria-label="Capture" onClick={() => setCapture({ trackId })}>
          <Icon name="plus" size={26} />
        </button>

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

// Track switcher: one dropdown instead of a bar of pills. current: track id, null = overview, undefined = another page.
function TrackMenu({ current, onNew }: { current: string | null | undefined; onNew: () => void }) {
  const { data } = useStore()
  const tracks = sortedTracks(data.tracks).filter((t) => t.status !== 'done')
  const open = openTasks(data.tasks)
  const sel = tracks.find((t) => t.id === current)
  const item = (t: Track, close: () => void) => {
    const n = open.filter((x) => x.track_id === t.id && x.lane === 'now').length
    return (
      <button key={t.id} role="menuitem" className={`s-${t.status} ${current === t.id ? 'on' : ''}`} style={{ '--c': t.color } as React.CSSProperties} onClick={() => (close(), goTrack(t.id))}>
        <span className="dot" />
        {t.name}
        {n > 0 && <span className="n">{n}</span>}
      </button>
    )
  }
  return (
    <Menu
      className="track-switch"
      label={
        <>
          <span className="dot" style={{ '--c': sel?.color ?? 'var(--accent)' } as React.CSSProperties} />
          <span className="ts-name">{sel ? sel.name : current === null ? 'All tracks' : 'Tracks'}</span>
          <Icon name="down" size={16} />
        </>
      }
    >
      {(close) => (
        <>
          <button role="menuitem" className={current === null ? 'on' : ''} onClick={() => (close(), goTrack(null))}>
            <span className="dot" style={{ '--c': 'var(--accent)' } as React.CSSProperties} />
            All tracks
          </button>
          {AREAS.map(({ area, label }) => {
            const list = tracks.filter((t) => t.area === area && t.status === 'active')
            return (
              list.length > 0 && (
                <div key={area} className="menu-group">
                  <span className="menu-label">{label}</span>
                  {list.map((t) => item(t, close))}
                </div>
              )
            )
          })}
          {tracks.some((t) => t.status !== 'active') && (
            <div className="menu-group">
              <span className="menu-label">Paused & parked</span>
              {tracks.filter((t) => t.status !== 'active').map((t) => item(t, close))}
            </div>
          )}
          <div className="menu-group">
            <button role="menuitem" className="muted" onClick={() => (close(), onNew())}>
              <Icon name="plus" size={16} />
              New track
            </button>
          </div>
        </>
      )}
    </Menu>
  )
}
