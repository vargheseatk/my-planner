import { useState } from 'react'
import { useStore } from '../store'
import type { Track, TrackStatus } from '../types'
import { AddLine, byUrgency, DueTag, EditText, openTasks, TaskCard } from '../components/ui'

const STATUSES: TrackStatus[] = ['active', 'paused', 'parked', 'done']

export function Tracks({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const { data, insert } = useStore()
  const track = data.tracks.find((t) => t.id === selected)
  if (track) return <TrackDetail track={track} onBack={() => onSelect(null)} />

  const tracks = data.tracks.slice().sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || a.sort - b.sort)
  const open = openTasks(data.tasks)

  return (
    <div className="view">
      <h1>Tracks</h1>
      <div className="track-grid">
        {tracks.map((t) => {
          const count = open.filter((x) => x.track_id === t.id).length
          return (
            <button key={t.id} className={`track-card s-${t.status}`} style={{ '--c': t.color } as React.CSSProperties} onClick={() => onSelect(t.id)}>
              <div className="tc-head">
                <span className="tc-name">{t.name}</span>
                <span className={`status s-${t.status}`}>{t.status}</span>
              </div>
              {t.next_step && <div className="tc-next">→ {t.next_step}</div>}
              <div className="meta">
                <span className="tag">{count} open</span>
                {t.review_on && <DueTag day={t.review_on} label="review" />}
              </div>
            </button>
          )
        })}
      </div>
      <h2>New track</h2>
      <AddLine
        placeholder="Track name"
        onAdd={(name) =>
          insert('tracks', {
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            sort: data.tracks.length,
          })
        }
      />
    </div>
  )
}

function TrackDetail({ track, onBack }: { track: Track; onBack: () => void }) {
  const { data, insert, update, remove } = useStore()
  const [showDone, setShowDone] = useState(false)
  const tasks = data.tasks.filter((t) => t.track_id === track.id)
  const open = openTasks(tasks).sort(byUrgency)
  const closed = tasks.filter((t) => t.status === 'done' || t.status === 'dropped')
  const principles = data.principles.filter((p) => p.track_id === track.id).sort((a, b) => a.sort - b.sort)
  const milestones = data.milestones.filter((m) => m.track_id === track.id).sort((a, b) => a.due_on.localeCompare(b.due_on))
  const ideas = data.ideas.filter((i) => i.track_id === track.id && (i.status === 'inbox' || i.status === 'kept'))
  const set = (patch: Partial<Track>) => update('tracks', track.id, patch)

  return (
    <div className="view">
      <button className="link back" onClick={onBack}>
        ‹ All tracks
      </button>
      <header className="track-head" style={{ '--c': track.color } as React.CSSProperties}>
        <input type="color" className="swatch" value={track.color} onChange={(e) => set({ color: e.target.value })} aria-label="Track colour" />
        <EditText className="h1" value={track.name} onSave={(name) => name && set({ name })} />
        <select className={`select status s-${track.status}`} value={track.status} onChange={(e) => set({ status: e.target.value as TrackStatus })}>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </header>

      <section className="card">
        <div className="label">Why this track</div>
        <EditText multiline value={track.purpose} placeholder="Purpose: why does this exist in my life?" onSave={(purpose) => set({ purpose: purpose || null })} />
        <div className="label">Next step</div>
        <EditText multiline value={track.next_step} placeholder="The one next physical action" onSave={(next_step) => set({ next_step: next_step || null })} />
        <div className="fields">
          <label>
            Review on
            <input type="date" className="select" value={track.review_on ?? ''} onChange={(e) => set({ review_on: e.target.value || null })} />
          </label>
        </div>
        <div className="label">Notes</div>
        <EditText multiline value={track.notes} placeholder="Context, status, links" onSave={(notes) => set({ notes: notes || null })} />
      </section>

      <section>
        <h2>Principles & mindset</h2>
        {principles.map((p) => (
          <div key={p.id} className="principle">
            <EditText className="ptitle" value={p.title} onSave={(title) => title && update('principles', p.id, { title })} />
            <EditText multiline value={p.body} placeholder="Why / how to apply" onSave={(body) => update('principles', p.id, { body: body || null })} />
            <button className="x" aria-label="Delete principle" onClick={() => confirm('Delete this principle?') && remove('principles', p.id)}>
              ×
            </button>
          </div>
        ))}
        <AddLine placeholder="Add a principle for this track" onAdd={(title) => insert('principles', { title, track_id: track.id, sort: principles.length })} />
      </section>

      {milestones.length > 0 && (
        <section>
          <h2>Milestones</h2>
          <ul className="milestones">
            {milestones.map((m) => (
              <li key={m.id} className={m.done ? 'on' : ''}>
                <input type="checkbox" checked={m.done} onChange={() => update('milestones', m.id, { done: !m.done })} />
                <span>{m.title}</span>
                <DueTag day={m.due_on} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>
          Open tasks <span className="count">{open.length}</span>
        </h2>
        {open.map((t) => (
          <TaskCard key={t.id} task={t} showTrack={false} />
        ))}
        <AddLine placeholder="New task" onAdd={(title) => insert('tasks', { title, track_id: track.id, sort: tasks.length })} />
        {closed.length > 0 && (
          <button className="link" onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide' : 'Show'} {closed.length} closed
          </button>
        )}
        {showDone && closed.map((t) => <TaskCard key={t.id} task={t} showTrack={false} />)}
      </section>

      {ideas.length > 0 && (
        <section>
          <h2>Ideas</h2>
          <ul className="ideas-mini">
            {ideas.map((i) => (
              <li key={i.id}>{i.body}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
