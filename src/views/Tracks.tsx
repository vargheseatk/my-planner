import { useState } from 'react'
import { fmtDay } from '../dates'
import { goTrack } from '../nav'
import { useStore } from '../store'
import type { Area, Track, TrackStatus } from '../types'
import { Icon } from '../components/icons'
import { AREAS, AddLine, EditText, Segmented } from '../components/ui'

const STATUS: { value: TrackStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'parked', label: 'Parked' },
  { value: 'done', label: 'Done' },
]
const AREA_OPTS = AREAS.map((a) => ({ value: a.area, label: a.label }))
const COLORS = ['#b4532a', '#6b4fa0', '#3f7d4e', '#2f6fa3', '#8a6d1f', '#a33f6b', '#2f8a8a', '#5a5a5a']

// Everything about a track except its tasks: shown in the details sheet.
export function TrackDetails({ track }: { track: Track }) {
  const { data, insert, update, remove } = useStore()
  const principles = data.principles.filter((p) => p.track_id === track.id).sort((a, b) => a.sort - b.sort)
  const milestones = data.milestones.filter((m) => m.track_id === track.id).sort((a, b) => a.due_on.localeCompare(b.due_on))
  const ideas = data.ideas.filter((i) => i.track_id === track.id && (i.status === 'inbox' || i.status === 'kept'))
  const set = (patch: Partial<Track>) => update('tracks', track.id, patch)

  return (
    <div className="detail" style={{ '--c': track.color } as React.CSSProperties}>
      <div className="track-hero">
        <label className="swatch" title="Change colour">
          <input type="color" value={track.color} onChange={(e) => set({ color: e.target.value })} aria-label="Track colour" />
        </label>
        <EditText className="detail-title" value={track.name} onSave={(name) => name.trim() && set({ name: name.trim() })} />
      </div>
      <div className="field">
        <label>Area</label>
        <Segmented small value={track.area} options={AREA_OPTS} onChange={(area) => set({ area })} />
      </div>
      <div className="field">
        <label>Status</label>
        <Segmented small value={track.status} options={STATUS} onChange={(status) => set({ status })} />
      </div>
      <div className="field">
        <label>Purpose</label>
        <EditText multiline className="boxed" value={track.purpose} placeholder="Why does this track exist?" onSave={(purpose) => set({ purpose: purpose || null })} />
      </div>
      <div className="field">
        <label>Next-step note</label>
        <EditText multiline className="boxed" value={track.next_step} placeholder="A reminder shown under the track name" onSave={(next_step) => set({ next_step: next_step || null })} />
      </div>
      <div className="field">
        <label>Review on</label>
        <input type="date" className="boxed small" value={track.review_on ?? ''} onChange={(e) => set({ review_on: e.target.value || null })} />
      </div>

      <div className="field">
        <label>Principles</label>
        {principles.map((p) => (
          <div key={p.id} className="principle-row">
            <EditText className="pr-title" value={p.title} onSave={(title) => title && update('principles', p.id, { title })} />
            <EditText multiline className="pr-body" value={p.body} placeholder="Why / how to apply" onSave={(body) => update('principles', p.id, { body: body || null })} />
            <button className="icon-btn ghost small pr-x" aria-label="Delete principle" onClick={() => confirm('Delete this principle?') && remove('principles', p.id)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
        <AddLine placeholder="Add a principle" onAdd={(title) => insert('principles', { title, track_id: track.id, sort: principles.length })} />
      </div>

      <div className="field">
        <label>Milestones</label>
        <ul className="ms-list">
          {milestones.map((m) => (
            <li key={m.id} className={m.done ? 'on' : ''}>
              <button className={`tick small ${m.done ? 'on' : ''}`} aria-label="Toggle milestone" onClick={() => update('milestones', m.id, { done: !m.done })}>
                <Icon name="check" size={12} />
              </button>
              <span className="ms-title">{m.title}</span>
              <span className="muted small">{fmtDay(m.due_on, { day: 'numeric', month: 'short' })}</span>
            </li>
          ))}
        </ul>
        <MilestoneAdd onAdd={(title, due_on) => insert('milestones', { title, due_on, track_id: track.id })} />
      </div>

      {ideas.length > 0 && (
        <div className="field">
          <label>Ideas</label>
          <ul className="idea-list">
            {ideas.map((i) => (
              <li key={i.id}>{i.body}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="field">
        <label>Notes</label>
        <EditText multiline className="boxed notes" value={track.notes} placeholder="Context, status, links" onSave={(notes) => set({ notes: notes || null })} />
      </div>
    </div>
  )
}

export function NewTrack({ onDone }: { onDone: () => void }) {
  const { data, insert } = useStore()
  const [name, setName] = useState('')
  const [area, setArea] = useState<Area>('filmmaking')
  const [color, setColor] = useState(COLORS[data.tracks.length % COLORS.length])
  return (
    <form
      className="detail"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        const t = await insert('tracks', {
          name: name.trim(),
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          area,
          color,
          sort: data.tracks.length,
        })
        if (t) {
          onDone()
          goTrack(t.id)
        }
      }}
    >
      <input className="boxed big-input" autoFocus placeholder="Track name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="field">
        <label>Area</label>
        <Segmented value={area} options={AREA_OPTS} onChange={setArea} />
      </div>
      <div className="field">
        <label>Colour</label>
        <div className="chips">
          {COLORS.map((c) => (
            <button key={c} type="button" className={`color-dot ${c === color ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <button className="btn primary wide" disabled={!name.trim()}>
        Create track
      </button>
    </form>
  )
}

function MilestoneAdd({ onAdd }: { onAdd: (title: string, due: string) => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  return (
    <form
      className="ms-add"
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim() && due) {
          onAdd(title.trim(), due)
          setTitle('')
          setDue('')
        }
      }}
    >
      <input className="boxed" placeholder="New milestone" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="date" className="boxed small" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Milestone date" />
      <button className="btn small" disabled={!title.trim() || !due}>
        Add
      </button>
    </form>
  )
}
