import { useState } from 'react'
import { daysBetween, fmtDay, todayIso } from '../dates'
import { useStore } from '../store'
import type { Track, TrackStatus } from '../types'
import { Icon } from '../components/icons'
import { AddLine, byUrgency, DueTag, EditText, openTasks, Section, Segmented, sortedTracks, TaskRow, useUI } from '../components/ui'

const STATUS: { value: TrackStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'parked', label: 'Parked' },
  { value: 'done', label: 'Done' },
]

export function Tracks({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const { data, insert } = useStore()
  const track = data.tracks.find((t) => t.id === selected)
  if (track) return <TrackDetail track={track} onBack={() => onSelect(null)} />

  const all = sortedTracks(data.tracks)
  const groups = [
    ['Active', all.filter((t) => t.status === 'active')],
    ['Paused & parked', all.filter((t) => t.status === 'paused' || t.status === 'parked')],
    ['Done', all.filter((t) => t.status === 'done')],
  ] as const

  return (
    <div className="page">
      <header className="page-head">
        <h1>Tracks</h1>
        <p className="lede">The parallel streams of your life. Each one has a purpose, a next step and its own rules.</p>
      </header>
      {groups.map(
        ([label, list]) =>
          list.length > 0 && (
            <Section key={label} title={label} count={list.length}>
              <div className="track-grid">
                {list.map((t) => (
                  <TrackCard key={t.id} track={t} onOpen={() => onSelect(t.id)} />
                ))}
              </div>
            </Section>
          ),
      )}
      <Section title="New track">
        <AddLine
          placeholder="Name a new track and press Enter"
          onAdd={(name) =>
            insert('tracks', {
              name,
              slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
              sort: data.tracks.length,
            })
          }
        />
      </Section>
    </div>
  )
}

function TrackCard({ track, onOpen }: { track: Track; onOpen: () => void }) {
  const { data } = useStore()
  const tasks = data.tasks.filter((x) => x.track_id === track.id && x.status !== 'dropped')
  const open = openTasks(tasks).length
  const done = tasks.filter((x) => x.status === 'done').length
  const next = data.milestones.filter((m) => m.track_id === track.id && !m.done && m.due_on >= todayIso()).sort((a, b) => a.due_on.localeCompare(b.due_on))[0]
  return (
    <button className={`track-card s-${track.status}`} style={{ '--c': track.color } as React.CSSProperties} onClick={onOpen}>
      <div className="tc-top">
        <span className="tc-name">{track.name}</span>
        {track.status !== 'active' && <span className={`status-pill s-${track.status}`}>{track.status}</span>}
      </div>
      {track.next_step && <p className="tc-next">{track.next_step}</p>}
      <div className="tc-foot">
        {tasks.length > 0 && (
          <span className="tc-progress">
            <span className="bar">
              <span style={{ width: `${(done / tasks.length) * 100}%` }} />
            </span>
            {open} open
          </span>
        )}
        {next && (
          <span className="tc-ms">
            <Icon name="diamond" size={12} /> {next.title} · {daysBetween(todayIso(), next.due_on)}d
          </span>
        )}
        {!next && track.review_on && <DueTag day={track.review_on} label="Review" />}
      </div>
    </button>
  )
}

function TrackDetail({ track, onBack }: { track: Track; onBack: () => void }) {
  const { data, insert, update, remove } = useStore()
  const { openCapture } = useUI()
  const [showClosed, setShowClosed] = useState(false)
  const tasks = data.tasks.filter((t) => t.track_id === track.id)
  const open = openTasks(tasks).sort(byUrgency)
  const closed = tasks.filter((t) => t.status === 'done' || t.status === 'dropped')
  const principles = data.principles.filter((p) => p.track_id === track.id).sort((a, b) => a.sort - b.sort)
  const milestones = data.milestones.filter((m) => m.track_id === track.id).sort((a, b) => a.due_on.localeCompare(b.due_on))
  const ideas = data.ideas.filter((i) => i.track_id === track.id && (i.status === 'inbox' || i.status === 'kept'))
  const set = (patch: Partial<Track>) => update('tracks', track.id, patch)

  return (
    <div className="page track-page" style={{ '--c': track.color } as React.CSSProperties}>
      <button className="back" onClick={onBack}>
        <Icon name="left" size={16} /> All tracks
      </button>
      <header className="track-hero">
        <label className="swatch" title="Change colour">
          <input type="color" value={track.color} onChange={(e) => set({ color: e.target.value })} aria-label="Track colour" />
        </label>
        <div className="th-main">
          <EditText className="th-name" value={track.name} onSave={(name) => name.trim() && set({ name: name.trim() })} />
          <EditText multiline className="th-purpose" value={track.purpose} placeholder="Why does this track exist?" onSave={(purpose) => set({ purpose: purpose || null })} />
        </div>
      </header>
      <div className="th-controls">
        <Segmented small value={track.status} options={STATUS} onChange={(status) => set({ status })} />
        <label className="inline-date">
          Review
          <input type="date" className="boxed small" value={track.review_on ?? ''} onChange={(e) => set({ review_on: e.target.value || null })} />
        </label>
      </div>

      <div className="next-step">
        <p className="eyebrow">Next step</p>
        <EditText multiline value={track.next_step} placeholder="The one next physical action" onSave={(next_step) => set({ next_step: next_step || null })} />
      </div>

      <div className="track-grid-2">
        <div>
          <Section title="Tasks" count={open.length} action={<button className="btn small" onClick={() => openCapture({ kind: 'task', trackId: track.id })}><Icon name="plus" size={14} /> Task</button>}>
            <div className="list">
              {open.map((t) => (
                <TaskRow key={t.id} task={t} showTrack={false} />
              ))}
            </div>
            <AddLine placeholder="Quick add a task" onAdd={(title) => insert('tasks', { title, track_id: track.id, sort: tasks.length })} />
            {closed.length > 0 && (
              <button className="link small" onClick={() => setShowClosed(!showClosed)}>
                {showClosed ? 'Hide' : 'Show'} {closed.length} finished
              </button>
            )}
            {showClosed && (
              <div className="list">
                {closed.map((t) => (
                  <TaskRow key={t.id} task={t} showTrack={false} />
                ))}
              </div>
            )}
          </Section>

          {ideas.length > 0 && (
            <Section title="Ideas" count={ideas.length}>
              <ul className="idea-list">
                {ideas.map((i) => (
                  <li key={i.id}>{i.body}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div>
          <Section title="Principles">
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
          </Section>

          <Section title="Milestones">
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
          </Section>

          <Section title="Notes">
            <EditText multiline className="boxed notes" value={track.notes} placeholder="Context, status, links" onSave={(notes) => set({ notes: notes || null })} />
          </Section>
        </div>
      </div>
    </div>
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
