import { useState } from 'react'
import { addDays, iso, todayIso } from '../dates'
import { useStore } from '../store'
import type { Task } from '../types'
import { Icon } from '../components/icons'
import { TaskRow, openTasks } from '../components/ui'
import { SortableList, sortPatches } from '../components/Sortable'

const byDue = (a: Task, b: Task) => a.due_on!.localeCompare(b.due_on!) || a.sort - b.sort
const bySort = (a: Task, b: Task) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)

// Errands are tasks with no track: calls, reading, bank visits. They only need a reminder.
export function Errands() {
  const { data, insert, updateMany } = useStore()
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const today = todayIso()
  const errands = data.tasks.filter((t) => !t.track_id)
  const open = openTasks(errands)
  const groups: [string, Task[]][] = [
    ['Today', open.filter((t) => t.due_on && t.due_on <= today).sort(bySort)],
    ['Coming up', open.filter((t) => t.due_on && t.due_on > today).sort(byDue)],
    ['Anytime', open.filter((t) => !t.due_on).sort(bySort)],
  ]
  const doneToday = errands.filter((t) => t.status === 'done' && t.done_at && iso(new Date(t.done_at)) === today)

  const add = async () => {
    const title = text.trim()
    if (!title) return
    setText('')
    await insert('tasks', { title, track_id: null, due_on: due || null, sort: open.length })
  }

  return (
    <div className="panel errands-panel">
      <div className="panel-head">
        <h2>
          Errands <span className="count">{open.length}</span>
        </h2>
      </div>
      <form
        className="errand-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <div className="errand-input">
          <Icon name="plus" size={16} />
          <input placeholder="Call the bank, read that article…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        {text.trim() && (
          <div className="chips">
            {[
              ['', 'Anytime'],
              [today, 'Today'],
              [addDays(today, 1), 'Tomorrow'],
            ].map(([v, l]) => (
              <button key={l} type="button" className={`chip-btn small ${due === v ? 'on' : ''}`} onClick={() => setDue(v)}>
                {l}
              </button>
            ))}
            <input type="date" className="boxed small" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Pick a date" />
          </div>
        )}
      </form>

      {groups.map(
        ([label, list]) =>
          list.length > 0 && (
            <section key={label} className="errand-group">
              <h3 className="mini-head">{label}</h3>
              {label === 'Coming up' ? (
                <div className="list">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} showTrack={false} />
                  ))}
                </div>
              ) : (
                <SortableList className="list" items={list} id={(t) => t.id} onReorder={(next) => updateMany('tasks', sortPatches(next))}>
                  {(t, grip) => <TaskRow task={t} showTrack={false} grip={grip} />}
                </SortableList>
              )}
            </section>
          ),
      )}
      {open.length === 0 && <p className="lane-empty">No errands. Add one above.</p>}
      {doneToday.length > 0 && (
        <section className="errand-group">
          <h3 className="mini-head">Done today</h3>
          <div className="list">
            {doneToday.map((t) => (
              <TaskRow key={t.id} task={t} showTrack={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
