import { useState } from 'react'
import { useStore } from '../store'
import type { CheckItem, Task, TaskStatus } from '../types'
import { Icon } from './icons'
import { EditText, Segmented, TrackChips } from './ui'

const STATUS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Done' },
]

export function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { update, remove } = useStore()
  const [newItem, setNewItem] = useState('')
  const set = (patch: Partial<Task>) => update('tasks', task.id, patch)
  const list = task.checklist ?? []
  const doneCount = list.filter((c) => c.done).length
  const setList = (checklist: CheckItem[]) => set({ checklist })
  const addItem = () => {
    if (!newItem.trim()) return
    setList([...list, { text: newItem.trim(), done: false }])
    setNewItem('')
  }

  return (
    <div className="detail">
      <EditText multiline className="detail-title" value={task.title} onSave={(title) => title.trim() && set({ title: title.trim() })} />

      <Segmented value={task.status === 'dropped' ? 'todo' : task.status} options={STATUS} onChange={(status) => set({ status })} />
      {task.status === 'waiting' && (
        <div className="field">
          <label>Waiting on</label>
          <EditText className="boxed" value={task.waiting_on} placeholder="Who or what?" onSave={(v) => set({ waiting_on: v || null })} />
        </div>
      )}

      <div className="field">
        <label>
          Checklist {list.length > 0 && <span className="count">{doneCount}/{list.length}</span>}
        </label>
        {list.length > 0 && (
          <div className="progress">
            <span style={{ width: `${(doneCount / list.length) * 100}%` }} />
          </div>
        )}
        <ul className="checklist">
          {list.map((c, i) => (
            <li key={i} className={c.done ? 'on' : ''}>
              <button className={`tick small ${c.done ? 'on' : ''}`} aria-label="Toggle item" onClick={() => setList(list.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}>
                <Icon name="check" size={12} />
              </button>
              <EditText value={c.text} onSave={(text) => setList(text.trim() ? list.map((x, j) => (j === i ? { ...x, text } : x)) : list.filter((_, j) => j !== i))} />
              <button className="icon-btn ghost" aria-label="Remove item" onClick={() => setList(list.filter((_, j) => j !== i))}>
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
        <div className="addline">
          <Icon name="plus" size={16} />
          <input className="edit" placeholder="Add a step" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} onBlur={addItem} />
        </div>
      </div>

      <div className="field">
        <label>Track</label>
        <TrackChips value={task.track_id} onChange={(track_id) => set({ track_id })} onlyLive />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Start</label>
          <input type="date" className="boxed" value={task.start_on ?? ''} onChange={(e) => set({ start_on: e.target.value || null })} />
        </div>
        <div className="field">
          <label>Due</label>
          <input type="date" className="boxed" value={task.due_on ?? ''} onChange={(e) => set({ due_on: e.target.value || null })} />
        </div>
      </div>

      <div className="field">
        <label>Priority</label>
        <Segmented
          small
          value={task.priority}
          options={[
            { value: 1, label: 'High' },
            { value: 2, label: 'Normal' },
            { value: 3, label: 'Low' },
          ]}
          onChange={(priority) => set({ priority })}
        />
      </div>

      <div className="field">
        <label>Notes</label>
        <EditText multiline className="boxed notes" value={task.notes} placeholder="Context, links, thoughts" onSave={(v) => set({ notes: v || null })} />
      </div>

      <div className="detail-foot">
        {task.status !== 'dropped' ? (
          <button className="btn ghost" onClick={() => set({ status: 'dropped' })}>
            Drop task
          </button>
        ) : (
          <button className="btn ghost" onClick={() => set({ status: 'todo' })}>
            Restore
          </button>
        )}
        <button
          className="btn ghost danger"
          onClick={() => {
            if (confirm('Delete this task for good?')) {
              onClose()
              remove('tasks', task.id)
            }
          }}
        >
          <Icon name="trash" size={16} /> Delete
        </button>
      </div>
    </div>
  )
}
