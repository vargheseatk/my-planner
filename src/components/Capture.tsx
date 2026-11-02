import { useState } from 'react'
import { addDays, todayIso } from '../dates'
import { useStore } from '../store'
import type { Lane } from '../types'
import { Segmented, TrackChips, type CaptureDefaults } from './ui'

// Quick capture: an idea for the inbox, a task straight into a track, or (no track) an errand.
export function Capture({ defaults, onDone }: { defaults: CaptureDefaults; onDone: () => void }) {
  const { insert } = useStore()
  const [kind, setKind] = useState<'idea' | 'task'>(defaults.kind ?? 'idea')
  const [text, setText] = useState('')
  const [trackId, setTrackId] = useState<string | null>(defaults.trackId ?? null)
  const [due, setDue] = useState('')
  const [lane, setLane] = useState<Lane>('now')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    const ok =
      kind === 'idea'
        ? await insert('ideas', { body, track_id: trackId })
        : await insert('tasks', { title: body, track_id: trackId, due_on: due || null, lane })
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <form
      className="capture-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <Segmented
        value={kind}
        options={[
          { value: 'idea', label: 'Idea' },
          { value: 'task', label: 'Task' },
        ]}
        onChange={setKind}
      />
      <textarea
        className="capture-text"
        autoFocus
        rows={4}
        placeholder={kind === 'idea' ? "What's on your mind?" : 'What needs doing?'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
        }}
      />
      <div className="field">
        <label>Track{kind === 'task' && !trackId && <span className="muted">· none = errand</span>}</label>
        <TrackChips value={trackId} onChange={setTrackId} onlyLive />
      </div>
      {kind === 'task' && trackId && (
        <div className="field">
          <label>Lane</label>
          <Segmented small value={lane} options={[{ value: 'now', label: 'Priority' }, { value: 'later', label: 'Later' }]} onChange={setLane} />
        </div>
      )}
      {kind === 'task' && (
        <div className="field">
          <label>Due</label>
          <div className="chips">
            {[
              ['', 'No date'],
              [todayIso(), 'Today'],
              [addDays(todayIso(), 1), 'Tomorrow'],
              [addDays(todayIso(), 7), 'In a week'],
            ].map(([v, l]) => (
              <button key={l} type="button" className={`chip-btn ${due === v ? 'on' : ''}`} onClick={() => setDue(v)}>
                {l}
              </button>
            ))}
            <input type="date" className="boxed small" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
      )}
      <button className="btn primary wide" disabled={!text.trim() || busy}>
        {kind === 'idea' ? 'Save to Ideas' : trackId ? 'Add task' : 'Add errand'}
      </button>
      <p className="hint">Ctrl + Enter to save · Esc to close</p>
    </form>
  )
}
