import { useEffect, useRef, useState } from 'react'
import { relative, todayIso } from '../dates'
import { useStore } from '../store'
import type { CheckItem, Task, Track } from '../types'

// Text that saves on blur. Multiline renders a textarea that grows with content.
export function EditText({
  value,
  onSave,
  placeholder,
  multiline,
  className = '',
}: {
  value: string | null
  onSave: (v: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
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
    <textarea
      ref={ref}
      className={`edit ${className}`}
      rows={1}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
    />
  ) : (
    <input
      className={`edit ${className}`}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

export function TrackDot({ track }: { track?: Track }) {
  return <span className="dot" style={{ background: track?.color ?? 'var(--muted)' }} />
}

export function TrackChip({ track }: { track?: Track }) {
  if (!track) return null
  return (
    <span className="chip" style={{ '--c': track.color } as React.CSSProperties}>
      {track.name}
    </span>
  )
}

export function TrackSelect({
  value,
  onChange,
  empty = 'No track',
}: {
  value: string | null
  onChange: (id: string | null) => void
  empty?: string
}) {
  const { data } = useStore()
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{empty}</option>
      {data.tracks
        .slice()
        .sort((a, b) => a.sort - b.sort)
        .map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
    </select>
  )
}

export function DueTag({ day, label }: { day: string | null; label?: string }) {
  if (!day) return null
  const t = todayIso()
  const cls = day < t ? 'due over' : day === t ? 'due now' : 'due'
  return (
    <span className={cls} title={day}>
      {label ? `${label} ` : ''}
      {relative(day)}
    </span>
  )
}

// One task: status toggle, title, meta, expandable checklist and notes.
export function TaskCard({ task, open: openInit = false, showTrack = true }: { task: Task; open?: boolean; showTrack?: boolean }) {
  const { data, update, remove } = useStore()
  const [open, setOpen] = useState(openInit)
  const [newItem, setNewItem] = useState('')
  const track = data.tracks.find((t) => t.id === task.track_id)
  const done = task.status === 'done'
  const list = task.checklist ?? []
  const doneCount = list.filter((c) => c.done).length

  const setList = (checklist: CheckItem[]) => update('tasks', task.id, { checklist })
  const addItem = () => {
    if (!newItem.trim()) return
    setList([...list, { text: newItem.trim(), done: false }])
    setNewItem('')
  }

  return (
    <div className={`task ${done ? 'is-done' : ''} p${task.priority}`}>
      <div className="task-row">
        <button
          className={`check ${done ? 'on' : ''}`}
          aria-label={done ? 'Mark not done' : 'Mark done'}
          onClick={() => update('tasks', task.id, { status: done ? 'todo' : 'done' })}
        />
        <div className="task-main" onClick={() => setOpen(!open)}>
          <div className="task-title">{task.title}</div>
          <div className="meta">
            {showTrack && <TrackChip track={track} />}
            {task.status === 'doing' && <span className="tag doing">doing</span>}
            {task.status === 'waiting' && <span className="tag waiting">waiting{task.waiting_on ? ` on ${task.waiting_on}` : ''}</span>}
            {list.length > 0 && (
              <span className="tag">
                {doneCount}/{list.length}
              </span>
            )}
            {task.start_on && task.start_on > todayIso() && <DueTag day={task.start_on} label="starts" />}
            {!done && <DueTag day={task.due_on} />}
          </div>
        </div>
      </div>
      {open && (
        <div className="task-body">
          <EditText className="title-edit" value={task.title} onSave={(title) => title && update('tasks', task.id, { title })} />
          <ul className="checklist">
            {list.map((c, i) => (
              <li key={i} className={c.done ? 'on' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={c.done}
                    onChange={() => setList(list.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                  />
                  <span>{c.text}</span>
                </label>
                <button className="x" aria-label="Remove item" onClick={() => setList(list.filter((_, j) => j !== i))}>
                  ×
                </button>
              </li>
            ))}
            <li className="add">
              <input
                className="edit"
                placeholder="Add checklist item"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                onBlur={addItem}
              />
            </li>
          </ul>
          <EditText multiline value={task.notes} placeholder="Notes" onSave={(notes) => update('tasks', task.id, { notes: notes || null })} />
          <div className="fields">
            <label>
              Status
              <select className="select" value={task.status} onChange={(e) => update('tasks', task.id, { status: e.target.value as Task['status'] })}>
                {['todo', 'doing', 'waiting', 'done', 'dropped'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Track
              <TrackSelect value={task.track_id} onChange={(track_id) => update('tasks', task.id, { track_id })} />
            </label>
            <label>
              Priority
              <select className="select" value={task.priority} onChange={(e) => update('tasks', task.id, { priority: Number(e.target.value) })}>
                <option value={1}>High</option>
                <option value={2}>Normal</option>
                <option value={3}>Low</option>
              </select>
            </label>
            <label>
              Starts
              <input type="date" className="select" value={task.start_on ?? ''} onChange={(e) => update('tasks', task.id, { start_on: e.target.value || null })} />
            </label>
            <label>
              Due
              <input type="date" className="select" value={task.due_on ?? ''} onChange={(e) => update('tasks', task.id, { due_on: e.target.value || null })} />
            </label>
            {task.status === 'waiting' && (
              <label>
                Waiting on
                <EditText value={task.waiting_on} onSave={(waiting_on) => update('tasks', task.id, { waiting_on: waiting_on || null })} />
              </label>
            )}
          </div>
          <div className="row-end">
            <button className="link danger" onClick={() => confirm('Delete this task?') && remove('tasks', task.id)}>
              Delete task
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// One-line add box.
export function AddLine({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  const [v, setV] = useState('')
  const submit = () => {
    if (!v.trim()) return
    onAdd(v.trim())
    setV('')
  }
  return (
    <form
      className="addline"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input className="edit" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn" disabled={!v.trim()}>
        Add
      </button>
    </form>
  )
}

export const openTasks = (tasks: Task[]) => tasks.filter((t) => t.status === 'todo' || t.status === 'doing' || t.status === 'waiting')

export function byUrgency(a: Task, b: Task) {
  const da = a.due_on ?? '9999'
  const db = b.due_on ?? '9999'
  return a.priority - b.priority || da.localeCompare(db) || a.sort - b.sort
}
