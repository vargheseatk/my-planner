import { useState } from 'react'
import { addDays, fmtDay, relative, todayIso, weekStart } from '../dates'
import { go } from '../nav'
import { useStore } from '../store'
import type { Milestone, Task } from '../types'
import { Icon } from '../components/icons'
import { openTasks, TaskRow, TrackChips } from '../components/ui'

type Item = { kind: 'task'; day: string; task: Task } | { kind: 'ms'; day: string; ms: Milestone }

// Week by week from today: milestones and dated tasks on one line of time.
export function Timeline() {
  const { data, insert, update, remove } = useStore()
  const [adding, setAdding] = useState(false)
  const today = todayIso()
  const dated = openTasks(data.tasks).filter((t) => t.due_on)
  const overdue = dated.filter((t) => t.due_on! < today).sort((a, b) => a.due_on!.localeCompare(b.due_on!))
  const items: Item[] = [
    ...dated.filter((t) => t.due_on! >= today).map((task) => ({ kind: 'task' as const, day: task.due_on!, task })),
    ...data.milestones.filter((m) => !m.done && m.due_on >= today).map((ms) => ({ kind: 'ms' as const, day: ms.due_on, ms })),
  ].sort((a, b) => a.day.localeCompare(b.day) || (a.kind === 'ms' ? -1 : 1))
  const undated = openTasks(data.tasks).filter((t) => !t.due_on).length

  const weeks = new Map<string, Item[]>()
  for (const it of items) {
    const w = weekStart(it.day)
    weeks.set(w, [...(weeks.get(w) ?? []), it])
  }

  return (
    <div className="page narrow">
      <header className="page-head row">
        <div>
          <h1>Timeline</h1>
          <p className="lede">What's coming, week by week.</p>
        </div>
        <button className="btn" onClick={() => setAdding(!adding)}>
          <Icon name="diamond" size={14} /> Milestone
        </button>
      </header>
      {adding && <MilestoneAdd onAdd={(m) => (insert('milestones', m), setAdding(false))} />}

      {overdue.length > 0 && (
        <section className="week overdue">
          <h2 className="week-title">Overdue</h2>
          <div className="list">
            {overdue.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}

      {[...weeks.entries()].map(([w, list]) => {
        const end = addDays(w, 6)
        const thisWeek = w <= today && today <= end
        let lastDay = ''
        return (
          <section key={w} className="week">
            <h2 className="week-title">
              {thisWeek ? 'This week' : w === addDays(weekStart(today), 7) ? 'Next week' : `Week of ${fmtDay(w, { day: 'numeric', month: 'short' })}`}
              <span className="muted small">
                {fmtDay(w, { day: 'numeric', month: 'short' })} – {fmtDay(end, { day: 'numeric', month: 'short' })}
              </span>
            </h2>
            <div className="tl">
              {list.map((it) => {
                const showDay = it.day !== lastDay
                lastDay = it.day
                const track = data.tracks.find((t) => t.id === (it.kind === 'ms' ? it.ms.track_id : it.task.track_id))
                return (
                  <div key={it.kind + (it.kind === 'ms' ? it.ms.id : it.task.id)} className={`tl-item ${showDay ? 'first' : ''}`}>
                    <div className="tl-day">
                      {showDay && (
                        <>
                          <b>{fmtDay(it.day, { day: 'numeric' })}</b>
                          <span>{fmtDay(it.day, { weekday: 'short' })}</span>
                        </>
                      )}
                    </div>
                    <div className="tl-body">
                      {it.kind === 'ms' ? (
                        <div className="tl-ms" style={{ '--c': track?.color ?? 'var(--accent)' } as React.CSSProperties}>
                          <Icon name="diamond" size={16} />
                          <div className="tl-ms-main">
                            <b>{it.ms.title}</b>
                            <span className="muted small">
                              {track && (
                                <button className="link-plain" onClick={() => go('tracks', track.id)}>
                                  {track.name}
                                </button>
                              )}
                              {track && ' · '}
                              {relative(it.day)}
                            </span>
                          </div>
                          <button className="btn small ghost" onClick={() => update('milestones', it.ms.id, { done: true })}>
                            Done
                          </button>
                          <button className="icon-btn ghost small" aria-label="Delete milestone" onClick={() => confirm('Delete milestone?') && remove('milestones', it.ms.id)}>
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      ) : (
                        <TaskRow task={it.task} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      {items.length === 0 && overdue.length === 0 && <p className="empty">Nothing dated yet.</p>}
      {undated > 0 && (
        <p className="muted small center">
          {undated} open {undated === 1 ? 'task has' : 'tasks have'} no due date. They live in their tracks.
        </p>
      )}
    </div>
  )
}

function MilestoneAdd({ onAdd }: { onAdd: (m: { title: string; due_on: string; track_id: string | null }) => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(addDays(todayIso(), 7))
  const [track, setTrack] = useState<string | null>(null)
  return (
    <form
      className="card stack"
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
        <button className="btn primary" disabled={!title.trim()}>
          Add milestone
        </button>
      </div>
    </form>
  )
}
