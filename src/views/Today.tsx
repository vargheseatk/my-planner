import { useState } from 'react'
import { addDays, daysBetween, fmtDay, todayIso } from '../dates'
import { go } from '../nav'
import { useStore } from '../store'
import type { Block, Day, Task } from '../types'
import { Icon } from '../components/icons'
import { byUrgency, EditText, openTasks, Section, Sheet, TaskRow, TrackChips, useUI } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function Today() {
  const { data, insert, update } = useStore()
  const { openCapture } = useUI()
  const [day, setDay] = useState(todayIso())
  const [picking, setPicking] = useState(false)
  const [pIndex, setPIndex] = useState(0)
  const isToday = day === todayIso()
  const plan = data.days.find((d) => d.day === day)
  const focus = data.tracks.find((t) => t.id === plan?.focus_track_id)

  // The day row is created lazily on first edit.
  const save = async (patch: Partial<Day>) => {
    if (plan) await update('days', plan.id, patch)
    else await insert('days', { day, ...patch })
  }

  const open = openTasks(data.tasks)
  const top = (plan?.top_task_ids ?? []).map((id) => data.tasks.find((t) => t.id === id)).filter((t): t is Task => t !== undefined)
  const topIds = new Set(top.map((t) => t.id))
  const live = (t: Task) => !topIds.has(t.id) && (!t.start_on || t.start_on <= day)
  const overdue = open.filter((t) => live(t) && t.status !== 'waiting' && t.due_on && t.due_on < day).sort(byUrgency)
  const dueSoon = open.filter((t) => live(t) && t.status !== 'waiting' && t.due_on && t.due_on >= day && t.due_on <= addDays(day, 2)).sort(byUrgency)
  const waiting = open.filter((t) => t.status === 'waiting' && !topIds.has(t.id))

  const principles = data.principles.filter((p) => p.active && (p.track_id === null || p.track_id === focus?.id)).sort((a, b) => (a.track_id ? 0 : 1) - (b.track_id ? 0 : 1) || a.sort - b.sort)
  // Rotate the featured principle by date so each day surfaces a different one.
  const seed = daysBetween('2026-01-01', day)
  const principle = principles.length ? principles[(((seed + pIndex) % principles.length) + principles.length) % principles.length] : null
  const principleTrack = data.tracks.find((t) => t.id === principle?.track_id)

  const milestones = data.milestones.filter((m) => !m.done && m.due_on >= day).sort((a, b) => a.due_on.localeCompare(b.due_on)).slice(0, 3)
  const blocks = plan?.blocks ?? []
  const setBlocks = (b: Block[]) => save({ blocks: b.slice().sort((x, y) => x.time.localeCompare(y.time)) })
  const doneToday = top.filter((t) => t.status === 'done').length

  return (
    <div className="page today">
      <header className="today-head">
        <div>
          <p className="eyebrow">{fmtDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{isToday ? greeting() : fmtDay(day, { weekday: 'long' })}</h1>
        </div>
        <div className="daynav">
          <button className="icon-btn" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
            <Icon name="left" />
          </button>
          <button className={`btn small ${isToday ? 'ghost' : ''}`} disabled={isToday} onClick={() => setDay(todayIso())}>
            Today
          </button>
          <button className="icon-btn" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
            <Icon name="right" />
          </button>
        </div>
      </header>

      {milestones.length > 0 && (
        <div className="countdowns">
          {milestones.map((m) => {
            const t = data.tracks.find((x) => x.id === m.track_id)
            const n = daysBetween(day, m.due_on)
            return (
              <button key={m.id} className="countdown" style={{ '--c': t?.color ?? 'var(--accent)' } as React.CSSProperties} onClick={() => go('timeline')}>
                <b>{n}</b>
                <span>
                  {n === 1 ? 'day' : 'days'} to
                  <em>{m.title}</em>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="today-grid">
        <div className="col-main">
          <section className={`focus-card ${focus ? 'has' : ''}`} style={{ '--c': focus?.color ?? 'var(--line-strong)' } as React.CSSProperties}>
            <p className="eyebrow">Today's focus</p>
            {focus ? (
              <>
                <div className="focus-name">
                  <button className="link-plain" onClick={() => go('tracks', focus.id)}>
                    {focus.name}
                  </button>
                  <button className="link small" onClick={() => save({ focus_track_id: null })}>
                    Change
                  </button>
                </div>
                {focus.next_step && (
                  <p className="focus-next">
                    <Icon name="arrow" size={16} /> {focus.next_step}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="muted">Pick the one track that gets your best hours today.</p>
                <TrackChips value={null} allowNone={false} onChange={(focus_track_id) => save({ focus_track_id })} onlyLive />
              </>
            )}
            <EditText multiline className="intention" value={plan?.intention ?? null} placeholder="What would make today a win?" onSave={(intention) => save({ intention: intention || null })} />
          </section>

          <Section
            title="Today's three"
            action={
              top.length > 0 && (
                <span className="muted small">
                  {doneToday} of {top.length} done
                </span>
              )
            }
          >
            <div className="three">
              {[0, 1, 2].map((i) => {
                const t = top[i]
                return t ? (
                  <div key={t.id} className="slot filled">
                    <span className="slot-n">{i + 1}</span>
                    <TaskRow task={t} onRemove={() => save({ top_task_ids: plan!.top_task_ids.filter((id) => id !== t.id) })} />
                  </div>
                ) : (
                  <button key={i} className="slot empty" onClick={() => setPicking(true)}>
                    <span className="slot-n">{i + 1}</span>
                    <span>Choose a task</span>
                  </button>
                )
              })}
            </div>
          </Section>

          {(overdue.length > 0 || dueSoon.length > 0) && (
            <Section title="Coming due" count={overdue.length + dueSoon.length}>
              <div className="list">
                {[...overdue, ...dueSoon].map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </Section>
          )}

          {waiting.length > 0 && (
            <Section title="Waiting on others" count={waiting.length}>
              <div className="list">
                {waiting.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="col-side">
          {principle && (
            <section className="principle-card">
              <Icon name="quote" size={22} className="q" />
              <p className="p-title">{principle.title}</p>
              {principle.body && <p className="p-body">{principle.body}</p>}
              <div className="p-foot">
                <span className="muted small">{principleTrack ? principleTrack.name : 'Life-wide'}</span>
                <span>
                  {principles.length > 1 && (
                    <>
                      <button className="icon-btn small" aria-label="Previous principle" onClick={() => setPIndex(pIndex - 1)}>
                        <Icon name="left" size={16} />
                      </button>
                      <button className="icon-btn small" aria-label="Next principle" onClick={() => setPIndex(pIndex + 1)}>
                        <Icon name="right" size={16} />
                      </button>
                    </>
                  )}
                </span>
              </div>
            </section>
          )}

          <Section title="Schedule">
            {blocks.length === 0 && <p className="muted small">Block time for the things that matter, like 45 min of scene sequencing.</p>}
            <ul className="blocks">
              {blocks.map((b, i) => (
                <li key={i} className={b.done ? 'on' : ''}>
                  <button className={`tick small ${b.done ? 'on' : ''}`} aria-label="Toggle block" onClick={() => setBlocks(blocks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}>
                    <Icon name="check" size={12} />
                  </button>
                  <span className="time">{b.time}</span>
                  <span className="lbl">{b.label}</span>
                  <button className="icon-btn ghost small" aria-label="Remove block" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>
                    <Icon name="x" size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <BlockAdd onAdd={(b) => setBlocks([...blocks, b])} />
          </Section>

          <section className="card close-day">
            <h3>Close the day</h3>
            <div className="energy" role="radiogroup" aria-label="Energy">
              <span className="muted small">Energy</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} role="radio" aria-checked={plan?.energy === n} className={`pip ${plan?.energy !== null && plan?.energy !== undefined && n <= plan.energy ? 'on' : ''}`} onClick={() => save({ energy: plan?.energy === n ? null : n })}>
                  {n}
                </button>
              ))}
            </div>
            <EditText multiline className="boxed" value={plan?.reflection ?? null} placeholder="What moved? What got in the way? What carries to tomorrow?" onSave={(reflection) => save({ reflection: reflection || null })} />
          </section>

          <button className="btn ghost wide" onClick={() => openCapture({ kind: 'task', trackId: focus?.id ?? null })}>
            <Icon name="plus" size={16} /> Add a task{focus ? ` to ${focus.name}` : ''}
          </button>
        </div>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Choose for today">
        <Picker
          day={day}
          exclude={topIds}
          focusId={focus?.id ?? null}
          onPick={(id) => {
            const ids = [...(plan?.top_task_ids ?? []), id]
            save({ top_task_ids: ids })
            if (ids.length >= 3) setPicking(false)
          }}
        />
      </Sheet>
    </div>
  )
}

function Picker({ day, exclude, focusId, onPick }: { day: string; exclude: Set<string>; focusId: string | null; onPick: (id: string) => void }) {
  const { data } = useStore()
  const candidates = openTasks(data.tasks)
    .filter((t) => !exclude.has(t.id) && t.status !== 'waiting' && (!t.start_on || t.start_on <= day))
    .sort(byUrgency)
  const soon = candidates.filter((t) => t.due_on && t.due_on <= addDays(day, 3))
  const inFocus = candidates.filter((t) => !soon.includes(t) && t.track_id === focusId)
  const rest = candidates.filter((t) => !soon.includes(t) && !inFocus.includes(t))
  const groups = [
    ['Due in the next few days', soon],
    ['From your focus track', inFocus],
    ['Everything else', rest],
  ] as const

  if (!candidates.length) return <p className="empty">No open tasks to choose from.</p>
  return (
    <div className="picker">
      {groups.map(
        ([label, list]) =>
          list.length > 0 && (
            <div key={label}>
              <p className="eyebrow">{label}</p>
              {list.map((t) => {
                const track = data.tracks.find((x) => x.id === t.track_id)
                return (
                  <button key={t.id} className="pick-row" style={{ '--c': track?.color ?? 'var(--muted)' } as React.CSSProperties} onClick={() => onPick(t.id)}>
                    <span className="dot" />
                    <span className="pick-title">{t.title}</span>
                    <Icon name="plus" size={16} />
                  </button>
                )
              })}
            </div>
          ),
      )}
    </div>
  )
}

function BlockAdd({ onAdd }: { onAdd: (b: Block) => void }) {
  const [time, setTime] = useState('09:00')
  const [label, setLabel] = useState('')
  return (
    <form
      className="block-add"
      onSubmit={(e) => {
        e.preventDefault()
        if (!label.trim()) return
        onAdd({ time, label: label.trim(), done: false })
        setLabel('')
      }}
    >
      <input type="time" className="boxed time-in" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
      <input className="boxed" placeholder="Add a block" value={label} onChange={(e) => setLabel(e.target.value)} />
    </form>
  )
}
