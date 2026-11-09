import { useState } from 'react'
import { addDays, fmtDay, todayIso, weekStart } from '../dates'
import { useStore } from '../store'
import type { Habit, HabitLog } from '../types'
import { Icon } from '../components/icons'
import { AddLine, EditText } from '../components/ui'
import { SortableList, sortPatches } from '../components/Sortable'

const MOTTO_KEY = 'habits_motto'
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export const activeHabits = (habits: Habit[]) => habits.filter((h) => h.active).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))

// Days in a row, counting back from today (or from yesterday while today is still open).
function streak(done: Set<string>, today: string) {
  let day = done.has(today) ? today : addDays(today, -1)
  let n = 0
  while (done.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

// Habit tracker: a week of tap-to-mark circles per habit, the motto on top, each habit's "why" below.
export function Habits() {
  const { data, insert, update, remove, updateMany } = useStore()
  const today = todayIso()
  const [weekOf, setWeekOf] = useState(() => weekStart(today))
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i))
  const habits = activeHabits(data.habits)
  const logsBy = new Map<string, HabitLog[]>()
  for (const l of data.habit_logs) logsBy.set(l.habit_id, [...(logsBy.get(l.habit_id) ?? []), l])

  const motto = data.settings.find((s) => s.key === MOTTO_KEY)
  const saveMotto = (value: string) => (motto ? update('settings', motto.id, { value: value || null }) : value && insert('settings', { key: MOTTO_KEY, value }))

  const toggle = (h: Habit, day: string) => {
    const hit = (logsBy.get(h.id) ?? []).find((l) => l.day === day)
    if (hit) remove('habit_logs', hit.id)
    else insert('habit_logs', { habit_id: h.id, day })
  }

  return (
    <div className="panel habits-panel">
      <EditText multiline className="habit-motto" value={motto?.value ?? null} placeholder="A line to keep you going" onSave={saveMotto} />

      <div className="habit-week">
        <button className="icon-btn ghost" aria-label="Previous week" onClick={() => setWeekOf(addDays(weekOf, -7))}>
          <Icon name="left" size={18} />
        </button>
        <button className="link-plain habit-range" onClick={() => setWeekOf(weekStart(today))} title="Back to this week">
          {weekOf === weekStart(today) ? 'This week' : `${fmtDay(days[0], { day: 'numeric', month: 'short' })} – ${fmtDay(days[6], { day: 'numeric', month: 'short' })}`}
        </button>
        <button className="icon-btn ghost" aria-label="Next week" disabled={weekOf >= weekStart(today)} onClick={() => setWeekOf(addDays(weekOf, 7))}>
          <Icon name="right" size={18} />
        </button>
      </div>

      <div className="habit-grid">
        <div className="habit-row habit-days">
          <span />
          <span className="habit-name-col" />
          {days.map((d, i) => (
            <span key={d} className={`habit-day ${d === today ? 'today' : ''}`}>
              {DAY_LETTERS[i]}
              <em>{Number(d.slice(8))}</em>
            </span>
          ))}
        </div>
        <SortableList items={habits} id={(h) => h.id} onReorder={(next) => updateMany('habits', sortPatches(next))}>
          {(h, grip) => {
            const logs = logsBy.get(h.id) ?? []
            const done = new Set(logs.map((l) => l.day))
            const s = streak(done, today)
            return (
              <div className="habit-row" style={{ '--c': h.color } as React.CSSProperties}>
                {grip}
                <span className="habit-name-col">
                  <EditText className="habit-name" value={h.name} onSave={(name) => name.trim() && update('habits', h.id, { name: name.trim() })} />
                  <span className="habit-meta">
                    {h.goal_count ? (
                      <span className="habit-goal">
                        <span className="bar">
                          <span style={{ width: `${Math.min(100, (logs.length / h.goal_count) * 100)}%` }} />
                        </span>
                        {logs.length}/{h.goal_count}
                      </span>
                    ) : null}
                    {s > 0 && <span>{s}-day streak</span>}
                  </span>
                </span>
                {days.map((d) => (
                  <button
                    key={d}
                    className={`habit-cell ${done.has(d) ? 'on' : ''} ${d === today ? 'today' : ''}`}
                    disabled={d > today}
                    aria-pressed={done.has(d)}
                    aria-label={`${h.name}, ${fmtDay(d)}`}
                    onClick={() => toggle(h, d)}
                  >
                    <Icon name="check" size={13} />
                  </button>
                ))}
              </div>
            )
          }}
        </SortableList>
        <AddLine placeholder="Add a habit" onAdd={(name) => insert('habits', { name, sort: habits.length })} />
      </div>

      {habits.length > 0 && (
        <section className="habit-whys">
          {habits.map((h) => (
            <div key={h.id} className="habit-why" style={{ '--c': h.color } as React.CSSProperties}>
              <span className="habit-why-name">{h.name}</span>
              <EditText multiline className="habit-why-text" value={h.principle} placeholder="Why this one matters" onSave={(principle) => update('habits', h.id, { principle: principle || null })} />
              <span className="habit-why-tools">
                <label title="Optional finish line, in days done">
                  Goal
                  <input
                    className="habit-goal-input"
                    type="number"
                    min={1}
                    defaultValue={h.goal_count ?? ''}
                    placeholder="–"
                    onBlur={(e) => {
                      const v = e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null
                      if (v !== h.goal_count) update('habits', h.id, { goal_count: v })
                    }}
                  />
                </label>
                <button className="icon-btn ghost small" aria-label={`Delete ${h.name}`} onClick={() => confirm(`Delete ${h.name} and its history?`) && remove('habits', h.id)}>
                  <Icon name="trash" size={14} />
                </button>
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
