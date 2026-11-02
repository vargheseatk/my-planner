import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtDay, relative, todayIso } from '../dates'
import { useStore } from '../store'
import type { Area, Task, Track } from '../types'
import { Icon } from './icons'

// ---------- App-level UI actions (task drawer, capture sheet) ----------

export interface CaptureDefaults {
  kind?: 'idea' | 'task'
  trackId?: string | null
}

interface UI {
  openTask: (id: string) => void
  openCapture: (d?: CaptureDefaults) => void
  openTrack: (id: string | null) => void // track details sheet; null = new track
}

export const UICtx = createContext<UI>({ openTask: () => {}, openCapture: () => {}, openTrack: () => {} })
export const useUI = () => useContext(UICtx)

// ---------- Inputs ----------

// Text that saves on blur. Multiline renders a textarea that grows with content.
export function EditText({
  value,
  onSave,
  placeholder,
  multiline,
  className = '',
  autoFocus,
}: {
  value: string | null
  onSave: (v: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
  autoFocus?: boolean
}) {
  const [v, setV] = useState(value ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setV(value ?? ''), [value])
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [v])
  const commit = () => {
    if (v !== (value ?? '')) onSave(v)
  }
  return multiline ? (
    <textarea ref={ref} className={`edit ${className}`} rows={1} value={v} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => setV(e.target.value)} onBlur={commit} />
  ) : (
    <input
      className={`edit ${className}`}
      value={v}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, small }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={`seg ${small ? 'small' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const AREAS: { area: Area; label: string }[] = [
  { area: 'filmmaking', label: 'Filmmaking' },
  { area: 'business', label: 'Business' },
  { area: 'personal', label: 'Personal' },
]

export const sortedTracks = (tracks: Track[]) => tracks.slice().sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.sort - b.sort)
const STATUS_ORDER = ['active', 'paused', 'parked', 'done']

// Horizontal chips to choose a track (or none).
export function TrackChips({ value, onChange, allowNone = true, onlyLive = false }: { value: string | null; onChange: (id: string | null) => void; allowNone?: boolean; onlyLive?: boolean }) {
  const { data } = useStore()
  const tracks = sortedTracks(data.tracks).filter((t) => !onlyLive || t.status !== 'done' || t.id === value)
  return (
    <div className="chips">
      {allowNone && (
        <button type="button" className={`chip-btn ${value === null ? 'on' : ''}`} onClick={() => onChange(null)}>
          None
        </button>
      )}
      {tracks.map((t) => (
        <button key={t.id} type="button" className={`chip-btn ${value === t.id ? 'on' : ''}`} style={{ '--c': t.color } as React.CSSProperties} onClick={() => onChange(value === t.id && allowNone ? null : t.id)}>
          <span className="dot" />
          {t.name}
        </button>
      ))}
    </div>
  )
}

export function TrackTag({ track }: { track?: Track }) {
  if (!track) return null
  return (
    <span className="track-tag" style={{ '--c': track.color } as React.CSSProperties}>
      <span className="dot" />
      {track.name}
    </span>
  )
}

export function DueTag({ day, label }: { day: string | null; label?: string }) {
  if (!day) return null
  const t = todayIso()
  const cls = day < t ? 'due over' : day === t ? 'due now' : 'due'
  return (
    <span className={cls} title={fmtDay(day)}>
      {label ? `${label} ` : ''}
      {relative(day)}
    </span>
  )
}

// ---------- Task row ----------

export function TaskRow({ task, showTrack = true, onRemove }: { task: Task; showTrack?: boolean; onRemove?: () => void }) {
  const { data, update } = useStore()
  const { openTask } = useUI()
  const track = data.tracks.find((t) => t.id === task.track_id)
  const done = task.status === 'done'
  const list = task.checklist ?? []
  const doneCount = list.filter((c) => c.done).length
  const future = task.start_on && task.start_on > todayIso()

  return (
    <div className={`trow ${done ? 'is-done' : ''} ${task.status === 'dropped' ? 'is-dropped' : ''}`} style={{ '--c': track?.color ?? 'var(--muted)' } as React.CSSProperties}>
      <button className={`tick ${done ? 'on' : ''}`} aria-label={done ? 'Mark not done' : 'Mark done'} onClick={() => update('tasks', task.id, { status: done ? 'todo' : 'done' })}>
        <Icon name="check" size={14} />
      </button>
      <button className="trow-main" onClick={() => openTask(task.id)}>
        <span className="trow-title">
          {task.priority === 1 && !done && <Icon name="flag" size={13} className="prio" />}
          {task.title}
        </span>
        <span className="trow-meta">
          {showTrack && <TrackTag track={track} />}
          {task.status === 'doing' && <span className="pill doing">In progress</span>}
          {task.status === 'waiting' && (
            <span className="pill waiting">
              <Icon name="hourglass" size={12} />
              {task.waiting_on ?? 'Waiting'}
            </span>
          )}
          {list.length > 0 && (
            <span className="mini-progress" title={`${doneCount} of ${list.length}`}>
              <span className="bar">
                <span style={{ width: `${(doneCount / list.length) * 100}%` }} />
              </span>
              <em>
                {doneCount}/{list.length}
              </em>
            </span>
          )}
          {future && <DueTag day={task.start_on} label="starts" />}
          {!done && <DueTag day={task.due_on} />}
        </span>
      </button>
      {onRemove && (
        <button className="icon-btn ghost" aria-label="Remove from list" onClick={onRemove}>
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  )
}

// ---------- Sheet (right drawer on desktop, bottom sheet on phones) ----------

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

// ---------- Small pieces ----------

export function AddLine({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  const [v, setV] = useState('')
  return (
    <form
      className="addline"
      onSubmit={(e) => {
        e.preventDefault()
        if (!v.trim()) return
        onAdd(v.trim())
        setV('')
      }}
    >
      <Icon name="plus" size={16} />
      <input className="edit" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
    </form>
  )
}

export function Section({ title, count, action, children, className = '' }: { title: ReactNode; count?: number; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`section ${className}`}>
      <div className="section-head">
        <h2>
          {title}
          {count !== undefined && <span className="count">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export const openTasks = (tasks: Task[]) => tasks.filter((t) => t.status === 'todo' || t.status === 'doing' || t.status === 'waiting')

export function byUrgency(a: Task, b: Task) {
  const da = a.due_on ?? '9999'
  const db = b.due_on ?? '9999'
  return a.priority - b.priority || da.localeCompare(db) || a.sort - b.sort
}

// Dropdown: a button that opens a small popover; closes on outside click, Esc or after a choice.
export function Menu({ label, className = '', align = 'left', children }: { label: ReactNode; className?: string; align?: 'left' | 'right'; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className={`menu ${align}`} ref={ref}>
      <button className={className} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
