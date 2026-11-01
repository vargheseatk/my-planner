import { useState } from 'react'
import { addDays, daysBetween, fmtDay, todayIso } from '../dates'
import { useStore } from '../store'
import type { Block, Day } from '../types'
import { AddLine, byUrgency, EditText, openTasks, TaskCard, TrackChip, TrackSelect } from '../components/ui'

export function Today() {
  const { data, insert, update } = useStore()
  const [day, setDay] = useState(todayIso())
  const isToday = day === todayIso()
  const plan = data.days.find((d) => d.day === day)
  const focus = data.tracks.find((t) => t.id === plan?.focus_track_id)

  // Create the day row lazily on first edit.
  const save = async (patch: Partial<Day>) => {
    if (plan) await update('days', plan.id, patch)
    else await insert('days', { day, ...patch })
  }

  const open = openTasks(data.tasks)
  const top = (plan?.top_task_ids ?? []).map((id) => data.tasks.find((t) => t.id === id)).filter((t) => t !== undefined)
  const topIds = new Set(top.map((t) => t.id))
  const onDeck = open
    .filter((t) => !topIds.has(t.id) && (t.due_on ? t.due_on <= addDays(day, 2) : false) && (!t.start_on || t.start_on <= day))
    .sort(byUrgency)
  const waiting = open.filter((t) => t.status === 'waiting' && !topIds.has(t.id))
  const candidates = open
    .filter((t) => !topIds.has(t.id) && t.status !== 'waiting' && (!t.start_on || t.start_on <= day))
    .sort(byUrgency)

  const principles = data.principles.filter((p) => p.active && (p.track_id === null || p.track_id === focus?.id)).sort((a, b) => a.sort - b.sort)
  const milestones = data.milestones.filter((m) => !m.done && m.due_on >= day).sort((a, b) => a.due_on.localeCompare(b.due_on)).slice(0, 3)
  const blocks = plan?.blocks ?? []
  const setBlocks = (b: Block[]) => save({ blocks: b.slice().sort((x, y) => x.time.localeCompare(y.time)) })

  return (
    <div className="view today">
      <header className="dayhead">
        <button className="icon" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
          ‹
        </button>
        <div>
          <h1>{isToday ? 'Today' : fmtDay(day, { weekday: 'long' })}</h1>
          <div className="sub">{fmtDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button className="icon" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
          ›
        </button>
        {!isToday && (
          <button className="link" onClick={() => setDay(todayIso())}>
            Back to today
          </button>
        )}
      </header>

      {milestones.length > 0 && (
        <div className="countdowns">
          {milestones.map((m) => (
            <div key={m.id} className="countdown">
              <b>{daysBetween(day, m.due_on)}</b>
              <span>days to {m.title}</span>
            </div>
          ))}
        </div>
      )}

      <section className="card focus" style={{ '--c': focus?.color ?? 'var(--line)' } as React.CSSProperties}>
        <div className="label">Focus track</div>
        <TrackSelect value={plan?.focus_track_id ?? null} onChange={(focus_track_id) => save({ focus_track_id })} empty="Pick one focus" />
        {focus?.next_step && (
          <p className="nextstep">
            <span className="label">Next step</span> {focus.next_step}
          </p>
        )}
        <EditText multiline value={plan?.intention ?? null} placeholder="Intention for the day: what would make today a win?" onSave={(intention) => save({ intention: intention || null })} />
      </section>

      {principles.length > 0 && (
        <section className="principles-strip">
          {principles.map((p) => (
            <details key={p.id}>
              <summary>{p.title}</summary>
              {p.body && <p>{p.body}</p>}
            </details>
          ))}
        </section>
      )}

      <section>
        <h2>
          Top 3 <span className="count">{top.length}/3</span>
        </h2>
        {top.map((t) => (
          <div key={t.id} className="pinned">
            <TaskCard task={t} />
            <button className="unpin" title="Remove from top 3" onClick={() => save({ top_task_ids: plan!.top_task_ids.filter((id) => id !== t.id) })}>
              ×
            </button>
          </div>
        ))}
        {top.length < 3 && (
          <select
            className="select pick"
            value=""
            onChange={(e) => e.target.value && save({ top_task_ids: [...(plan?.top_task_ids ?? []), e.target.value] })}
          >
            <option value="">+ Pick a task for today…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {data.tracks.find((x) => x.id === t.track_id)?.name ?? '—'} · {t.title}
              </option>
            ))}
          </select>
        )}
      </section>

      <section>
        <h2>Time blocks</h2>
        <ul className="blocks">
          {blocks.map((b, i) => (
            <li key={i} className={b.done ? 'on' : ''}>
              <input type="checkbox" checked={b.done} onChange={() => setBlocks(blocks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
              <span className="time">{b.time}</span>
              <span className="lbl">{b.label}</span>
              <button className="x" aria-label="Remove block" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <BlockAdd onAdd={(b) => setBlocks([...blocks, b])} />
      </section>

      {onDeck.length > 0 && (
        <section>
          <h2>Due soon</h2>
          {onDeck.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </section>
      )}

      {waiting.length > 0 && (
        <section>
          <h2>Waiting on others</h2>
          {waiting.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </section>
      )}

      <section className="card">
        <h2>End of day</h2>
        <div className="energy">
          <span className="label">Energy</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`pip ${plan?.energy === n ? 'on' : ''}`} onClick={() => save({ energy: plan?.energy === n ? null : n })}>
              {n}
            </button>
          ))}
        </div>
        <EditText multiline value={plan?.reflection ?? null} placeholder="What moved? What got in the way? What carries to tomorrow?" onSave={(reflection) => save({ reflection: reflection || null })} />
      </section>

      {focus && (
        <section>
          <h2>
            Quick add to <TrackChip track={focus} />
          </h2>
          <AddLine placeholder="New task" onAdd={(title) => insert('tasks', { title, track_id: focus.id })} />
        </section>
      )}
    </div>
  )
}

function BlockAdd({ onAdd }: { onAdd: (b: Block) => void }) {
  const [time, setTime] = useState('09:00')
  const [label, setLabel] = useState('')
  return (
    <form
      className="addline"
      onSubmit={(e) => {
        e.preventDefault()
        if (!label.trim()) return
        onAdd({ time, label: label.trim(), done: false })
        setLabel('')
      }}
    >
      <input type="time" className="select time-in" value={time} onChange={(e) => setTime(e.target.value)} />
      <input className="edit" placeholder="e.g. Parents scene sequencing (45 min)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <button className="btn" disabled={!label.trim()}>
        Add
      </button>
    </form>
  )
}
