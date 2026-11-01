import { useState } from 'react'
import { relative } from '../dates'
import { useStore } from '../store'
import type { Idea, IdeaStatus } from '../types'
import { Icon } from '../components/icons'
import { TrackTag, useUI } from '../components/ui'

const FILTERS: { key: IdeaStatus; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'kept', label: 'Kept' },
  { key: 'parked', label: 'Parked' },
  { key: 'converted', label: 'Became tasks' },
  { key: 'dropped', label: 'Dropped' },
]

export function Inbox() {
  const { data, insert } = useStore()
  const [filter, setFilter] = useState<IdeaStatus>('inbox')
  const [text, setText] = useState('')
  const ideas = data.ideas.filter((i) => i.status === filter).sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Ideas</h1>
        <p className="lede">Catch everything here. Sort it later: keep it, make it a task, park it or let it go.</p>
      </header>
      <form
        className="idea-capture"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          await insert('ideas', { body: text.trim() })
          setText('')
          setFilter('inbox')
        }}
      >
        <textarea
          rows={2}
          placeholder="Write an idea…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button className="btn primary" disabled={!text.trim()}>
          Save
        </button>
      </form>
      <div className="filter-tabs">
        {FILTERS.map((f) => {
          const n = data.ideas.filter((i) => i.status === f.key).length
          return (
            <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
              {n > 0 && <span className="count">{n}</span>}
            </button>
          )
        })}
      </div>
      {ideas.length === 0 && <p className="empty">{filter === 'inbox' ? 'Inbox zero. Nothing waiting to be sorted.' : 'Nothing here.'}</p>}
      <div className="idea-stack">
        {ideas.map((i) => (
          <IdeaCard key={i.id} idea={i} />
        ))}
      </div>
    </div>
  )
}

function IdeaCard({ idea }: { idea: Idea }) {
  const { data, insert, update, remove } = useStore()
  const { openTask } = useUI()
  const track = data.tracks.find((t) => t.id === idea.track_id)
  const set = (status: IdeaStatus) => update('ideas', idea.id, { status })

  const toTask = async () => {
    const created = await insert('tasks', { title: idea.body.slice(0, 140), notes: idea.body.length > 140 ? idea.body : null, track_id: idea.track_id })
    if (created) {
      set('converted')
      openTask(created.id)
    }
  }

  return (
    <article className="idea-card" style={{ '--c': track?.color ?? 'var(--line-strong)' } as React.CSSProperties}>
      <p className="idea-body">{idea.body}</p>
      <div className="idea-meta">
        <select className="track-select" value={idea.track_id ?? ''} onChange={(e) => update('ideas', idea.id, { track_id: e.target.value || null })} aria-label="Track">
          <option value="">No track</option>
          {data.tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {!track && <TrackTag track={track} />}
        <span className="muted small">
          {idea.source === 'claude' ? 'via Claude · ' : ''}
          {relative(idea.created_at.slice(0, 10))}
        </span>
      </div>
      <div className="idea-actions">
        {idea.status !== 'converted' && (
          <button className="btn small primary" onClick={toTask}>
            Make task
          </button>
        )}
        {idea.status !== 'kept' && (
          <button className="btn small" onClick={() => set('kept')}>
            Keep
          </button>
        )}
        {idea.status !== 'parked' && (
          <button className="btn small" onClick={() => set('parked')}>
            Park
          </button>
        )}
        {idea.status !== 'inbox' && (
          <button className="btn small ghost" onClick={() => set('inbox')}>
            Back to inbox
          </button>
        )}
        <span className="spacer" />
        {idea.status !== 'dropped' ? (
          <button className="btn small ghost" onClick={() => set('dropped')}>
            Let go
          </button>
        ) : (
          <button className="icon-btn ghost danger" aria-label="Delete forever" onClick={() => confirm('Delete forever?') && remove('ideas', idea.id)}>
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
    </article>
  )
}
