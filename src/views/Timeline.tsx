import { useState } from 'react'
import { addDays, fmtDay, todayIso, weekStart } from '../dates'
import { useStore } from '../store'
import { openTasks, TaskCard, TrackDot, TrackSelect } from '../components/ui'

// Weeks from now forward: milestones first, then dated tasks. Overdue at the top.
export function Timeline() {
  const { data, insert, update, remove } = useStore()
  const today = todayIso()
  const dated = openTasks(data.tasks).filter((t) => t.due_on)
  const overdue = dated.filter((t) => t.due_on! < today).sort((a, b) => a.due_on!.localeCompare(b.due_on!))
  const future = dated.filter((t) => t.due_on! >= today)
  const milestones = data.milestones.filter((m) => !m.done)
  const undated = openTasks(data.tasks).filter((t) => !t.due_on).length

  const last = [...future.map((t) => t.due_on!), ...milestones.map((m) => m.due_on)].sort().pop() ?? today
  const weeks: string[] = []
  for (let w = weekStart(today); w <= last; w = addDays(w, 7)) weeks.push(w)

  return (
    <div className="view">
      <h1>Timeline</h1>
      <MilestoneAdd onAdd={(m) => insert('milestones', m)} />

      {overdue.length > 0 && (
        <section className="week over">
          <h2>Overdue</h2>
          {overdue.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </section>
      )}

      {weeks.map((w) => {
        const end = addDays(w, 6)
        const ms = milestones.filter((m) => m.due_on >= w && m.due_on <= end).sort((a, b) => a.due_on.localeCompare(b.due_on))
        const ts = future.filter((t) => t.due_on! >= w && t.due_on! <= end).sort((a, b) => a.due_on!.localeCompare(b.due_on!) || a.priority - b.priority)
        if (!ms.length && !ts.length) return null
        return (
          <section key={w} className="week">
            <h2>
              {w <= today && today <= end ? 'This week' : `Week of ${fmtDay(w, { day: 'numeric', month: 'short' })}`}
              <span className="sub"> {fmtDay(w, { day: 'numeric', month: 'short' })} – {fmtDay(end, { day: 'numeric', month: 'short' })}</span>
            </h2>
            {ms.map((m) => (
              <div key={m.id} className="milestone">
                <span className="flag">◆</span>
                <TrackDot track={data.tracks.find((t) => t.id === m.track_id)} />
                <b>{m.title}</b>
                <span className="sub">{fmtDay(m.due_on)}</span>
                <button className="link" onClick={() => update('milestones', m.id, { done: true })}>
                  Done
                </button>
                <button className="x" aria-label="Delete milestone" onClick={() => confirm('Delete milestone?') && remove('milestones', m.id)}>
                  ×
                </button>
              </div>
            ))}
            {ts.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </section>
        )
      })}
      {undated > 0 && <p className="empty">{undated} open tasks have no due date. They live in their tracks.</p>}
    </div>
  )
}

function MilestoneAdd({ onAdd }: { onAdd: (m: { title: string; due_on: string; track_id: string | null }) => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(addDays(todayIso(), 7))
  const [track, setTrack] = useState<string | null>(null)
  return (
    <form
      className="addline wrap"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        onAdd({ title: title.trim(), due_on: due, track_id: track })
        setTitle('')
      }}
    >
      <input className="edit" placeholder="New milestone" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="date" className="select" value={due} onChange={(e) => setDue(e.target.value)} />
      <TrackSelect value={track} onChange={setTrack} />
      <button className="btn" disabled={!title.trim()}>
        Add
      </button>
    </form>
  )
}
