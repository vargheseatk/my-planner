import { useState } from 'react'
import { relative } from '../dates'
import { useStore } from '../store'
import type { Idea, IdeaStatus } from '../types'
import { AddLine, TrackChip, TrackSelect } from '../components/ui'

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
  const ideas = data.ideas.filter((i) => i.status === filter).sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="view">
      <h1>Ideas</h1>
      <AddLine placeholder="Capture an idea…" onAdd={(body) => insert('ideas', { body })} />
      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
            {f.label} <span className="count">{data.ideas.filter((i) => i.status === f.key).length}</span>
          </button>
        ))}
      </div>
      {ideas.length === 0 && <p className="empty">{filter === 'inbox' ? 'Inbox zero. Nice.' : 'Nothing here.'}</p>}
      {ideas.map((i) => (
        <IdeaCard key={i.id} idea={i} />
      ))}
    </div>
  )
}

function IdeaCard({ idea }: { idea: Idea }) {
  const { data, insert, update, remove } = useStore()
  const track = data.tracks.find((t) => t.id === idea.track_id)
  const set = (status: IdeaStatus) => update('ideas', idea.id, { status })

  const toTask = async () => {
    const created = await insert('tasks', { title: idea.body.slice(0, 140), notes: idea.body.length > 140 ? idea.body : null, track_id: idea.track_id })
    if (created) set('converted')
  }

  return (
    <div className="idea card">
      <p className="idea-body">{idea.body}</p>
      <div className="meta">
        <TrackChip track={track} />
        <span className="tag">{idea.source === 'claude' ? 'via Claude' : 'portal'}</span>
        <span className="tag">{relative(idea.created_at.slice(0, 10))}</span>
      </div>
      <div className="idea-actions">
        <TrackSelect value={idea.track_id} onChange={(track_id) => update('ideas', idea.id, { track_id })} empty="Assign track" />
        {idea.status !== 'kept' && <button className="btn" onClick={() => set('kept')}>Keep</button>}
        {idea.status !== 'converted' && <button className="btn" onClick={toTask}>Make task</button>}
        {idea.status !== 'parked' && <button className="btn ghost" onClick={() => set('parked')}>Park</button>}
        {idea.status !== 'inbox' && <button className="btn ghost" onClick={() => set('inbox')}>Back to inbox</button>}
        {idea.status !== 'dropped' ? (
          <button className="btn ghost" onClick={() => set('dropped')}>Drop</button>
        ) : (
          <button className="link danger" onClick={() => confirm('Delete forever?') && remove('ideas', idea.id)}>Delete</button>
        )}
      </div>
    </div>
  )
}
