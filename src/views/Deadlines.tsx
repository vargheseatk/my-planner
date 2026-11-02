import { useState } from 'react'
import { addDays, fmtDay, relative, todayIso, weekStart } from '../dates'
import { useStore } from '../store'
import { Icon } from '../components/icons'
import { TrackChips, openTasks, useUI } from '../components/ui'

interface Ev {
  key: string
  kind: 'task' | 'ms'
  id: string
  day: string
  title: string
  trackId: string | null
}

const WEEKS = 5
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Calendar of what is due when: dated tasks (track work and errands) plus milestones.
// With a track picked, other tracks fade so its dates stand out.
export function Deadlines({ trackId }: { trackId: string | null }) {
  const { data, insert, update, remove } = useStore()
  const { openTask } = useUI()
  const today = todayIso()
  const [start, setStart] = useState(() => weekStart(today))
  const [sel, setSel] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const color = (id: string | null) => data.tracks.find((t) => t.id === id)?.color ?? 'var(--muted)'
  const trackName = (id: string | null) => data.tracks.find((t) => t.id === id)?.name ?? 'Errand'
  const evs: Ev[] = [
    ...data.milestones.filter((m) => !m.done).map((m) => ({ key: 'm' + m.id, kind: 'ms' as const, id: m.id, day: m.due_on, title: m.title, trackId: m.track_id })),
    ...openTasks(data.tasks)
      .filter((t) => t.due_on)
      .map((t) => ({ key: 't' + t.id, kind: 'task' as const, id: t.id, day: t.due_on!, title: t.title, trackId: t.track_id })),
  ].sort((a, b) => a.day.localeCompare(b.day) || (a.kind === 'ms' ? -1 : 1))
  const dim = (e: Ev) => trackId !== null && e.trackId !== trackId
  const byDay = new Map<string, Ev[]>()
  for (const e of evs) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e])

  const overdue = evs.filter((e) => e.day < today)
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i))
  const end = days[days.length - 1]
  const agenda = sel ? byDay.get(sel) ?? [] : evs.filter((e) => e.day >= today && (!trackId || e.trackId === trackId)).slice(0, 8)

  const open = (e: Ev) => e.kind === 'task' && openTask(e.id)

  return (
    <div className="panel cal-panel">
      <div className="panel-head">
        <h2>Deadlines</h2>
        <div className="cal-nav">
          <button className="icon-btn small" aria-label="Earlier" onClick={() => setStart(addDays(start, -28))}>
            <Icon name="left" size={16} />
          </button>
          <button className="btn small ghost" onClick={() => setStart(weekStart(today))}>
            {fmtDay(start, { day: 'numeric', month: 'short' })} – {fmtDay(end, { day: 'numeric', month: 'short' })}
          </button>
          <button className="icon-btn small" aria-label="Later" onClick={() => setStart(addDays(start, 28))}>
            <Icon name="right" size={16} />
          </button>
          <button className="btn small" onClick={() => setAdding(!adding)}>
            <Icon name="diamond" size={13} /> Milestone
          </button>
        </div>
      </div>

      {adding && <MilestoneAdd trackId={trackId} onAdd={(m) => (insert('milestones', m), setAdding(false))} />}

      {overdue.length > 0 && (
        <div className="overdue">
          <span className="ov-label">Overdue</span>
          {overdue.map((e) => (
            <button key={e.key} className={`cal-ev ${dim(e) ? 'dim' : ''}`} style={{ '--c': color(e.trackId) } as React.CSSProperties} onClick={() => open(e)}>
              {e.title}
            </button>
          ))}
        </div>
      )}

      <div className="cal">
        {WEEKDAYS.map((d) => (
          <span key={d} className="cal-wd">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const list = byDay.get(d) ?? []
          const first = d === start || d.endsWith('-01')
          return (
            <button key={d} className={`cal-cell ${d === today ? 'today' : ''} ${d < today ? 'past' : ''} ${d === sel ? 'sel' : ''}`} onClick={() => setSel(sel === d ? null : d)}>
              <span className="cal-num">{first ? fmtDay(d, { day: 'numeric', month: 'short' }) : fmtDay(d, { day: 'numeric' })}</span>
              {list.slice(0, 3).map((e) => (
                <span key={e.key} className={`cal-ev ${e.kind} ${dim(e) ? 'dim' : ''}`} style={{ '--c': color(e.trackId) } as React.CSSProperties} title={`${e.title} · ${trackName(e.trackId)}`}>
                  {e.kind === 'ms' && <Icon name="diamond" size={10} />}
                  {e.title}
                </span>
              ))}
              {list.length > 3 && <span className="cal-more">+{list.length - 3}</span>}
            </button>
          )
        })}
      </div>

      <div className="agenda">
        <div className="agenda-head">
          <h2>{sel ? fmtDay(sel, { weekday: 'long', day: 'numeric', month: 'long' }) : trackId ? `Coming up · ${trackName(trackId)}` : 'Coming up'}</h2>
          {sel && (
            <button className="link small" onClick={() => setSel(null)}>
              Show upcoming
            </button>
          )}
        </div>
        {agenda.length === 0 && <p className="muted small">{sel ? 'Nothing due this day.' : 'Nothing dated ahead.'}</p>}
        {agenda.map((e) => (
          <div key={e.key} className={`ag-item ${e.kind}`} style={{ '--c': color(e.trackId) } as React.CSSProperties}>
            {e.kind === 'ms' ? <Icon name="diamond" size={14} className="ag-mark" /> : <span className="dot" />}
            <button className="ag-main" onClick={() => open(e)} disabled={e.kind === 'ms'}>
              <span className="ag-title">{e.title}</span>
              <span className="muted small">
                {trackName(e.trackId)}
                {!sel && ` · ${fmtDay(e.day, { weekday: 'short', day: 'numeric', month: 'short' })} · ${relative(e.day)}`}
              </span>
            </button>
            {e.kind === 'ms' && (
              <>
                <button className="btn small ghost" onClick={() => update('milestones', e.id, { done: true })}>
                  Done
                </button>
                <button className="icon-btn ghost small" aria-label="Delete milestone" onClick={() => confirm('Delete milestone?') && remove('milestones', e.id)}>
                  <Icon name="x" size={14} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MilestoneAdd({ trackId, onAdd }: { trackId: string | null; onAdd: (m: { title: string; due_on: string; track_id: string | null }) => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(addDays(todayIso(), 7))
  const [track, setTrack] = useState<string | null>(trackId)
  return (
    <form
      className="ms-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim()) onAdd({ title: title.trim(), due_on: due, track_id: track })
      }}
    >
      <div className="ms-add">
        <input className="boxed" autoFocus placeholder="Milestone, e.g. Final file in hand" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="date" className="boxed small" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Date" />
      </div>
      <TrackChips value={track} onChange={setTrack} onlyLive />
      <div>
        <button className="btn primary small" disabled={!title.trim()}>
          Add milestone
        </button>
      </div>
    </form>
  )
}
