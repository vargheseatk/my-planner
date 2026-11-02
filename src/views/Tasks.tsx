import { useRef, useState } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { goTrack } from '../nav'
import { useStore } from '../store'
import type { Lane, Task, Track } from '../types'
import { Icon } from '../components/icons'
import { AREAS, AddLine, DueTag, TaskRow, openTasks, sortedTracks, useUI } from '../components/ui'

const LANES: { lane: Lane; title: string }[] = [
  { lane: 'now', title: 'Priority' },
  { lane: 'later', title: 'Later' },
]

const bySort = (a: Task, b: Task) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)

// The tasks column: a track's Priority / Later lanes, or (no track picked) the overview.
export function TasksPanel({ trackId }: { trackId: string | null }) {
  const { data } = useStore()
  const track = data.tracks.find((t) => t.id === trackId)
  return track ? <TrackLanes key={track.id} track={track} /> : <Overview />
}

// ---------- One track: two sortable lanes ----------

type Lanes = Record<Lane, string[]>

function TrackLanes({ track }: { track: Track }) {
  const { data, insert, remove, updateMany } = useStore()
  const { openTrack } = useUI()
  // While dragging we hold the lane order locally; otherwise it comes straight from data.
  const [drag, setDrag] = useState<Lanes | null>(null)

  const tasks = data.tasks.filter((t) => t.track_id === track.id)
  const open = openTasks(tasks)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const fromData = (): Lanes => ({
    now: open.filter((t) => t.lane === 'now').sort(bySort).map((t) => t.id),
    later: open.filter((t) => t.lane !== 'now').sort(bySort).map((t) => t.id),
  })
  const lanes = drag ?? fromData()
  const finished = tasks.filter((t) => t.status === 'done').sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )
  const laneOf = (l: Lanes, id: UniqueIdentifier): Lane | null => (id === 'now' || id === 'later' ? id : l.now.includes(String(id)) ? 'now' : l.later.includes(String(id)) ? 'later' : null)

  // Crossing into the other lane: move the card there right away so the list opens a gap.
  // The ref mirrors `drag` so a drop that lands before the re-render still sees the latest order.
  const dragRef = useRef<Lanes | null>(null)
  const setLanes = (l: Lanes | null) => {
    dragRef.current = l
    setDrag(l)
  }

  // Crossing into the other lane: move the card there right away so the list opens a gap.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const l = dragRef.current ?? fromData()
    const from = laneOf(l, active.id)
    const to = laneOf(l, over.id)
    if (!from || !to || from === to) return
    const id = String(active.id)
    const at = l[to].indexOf(String(over.id))
    const dest = l[to].filter((x) => x !== id)
    dest.splice(at < 0 ? dest.length : at, 0, id)
    setLanes({ ...l, [from]: l[from].filter((x) => x !== id), [to]: dest })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    let l = dragRef.current ?? fromData()
    const lane = laneOf(l, active.id)
    if (over && lane && laneOf(l, over.id) === lane && active.id !== over.id) {
      const list = l[lane]
      const to = over.id === lane ? list.length - 1 : list.indexOf(String(over.id))
      l = { ...l, [lane]: arrayMove(list, list.indexOf(String(active.id)), to) }
    }
    const patches = (['now', 'later'] as Lane[]).flatMap((ln) =>
      l[ln].flatMap((id, sort) => {
        const t = byId.get(id)
        return t && (t.lane !== ln || t.sort !== sort) ? [{ id, patch: { lane: ln, sort } }] : []
      }),
    )
    if (patches.length) updateMany('tasks', patches)
    setLanes(null)
  }

  return (
    <div className="panel tasks-panel" style={{ '--c': track.color } as React.CSSProperties}>
      <header className="track-head">
        <span className="dot big" />
        <h1>{track.name}</h1>
        {track.status !== 'active' && <span className={`status-pill s-${track.status}`}>{track.status}</span>}
        <button className="icon-btn" aria-label="Track details" title="Purpose, notes, principles, milestones" onClick={() => openTrack(track.id)}>
          <Icon name="more" />
        </button>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setLanes(null)}>
        {LANES.map(({ lane, title }) => (
          <LaneList
            key={lane}
            lane={lane}
            title={title}
            ids={lanes[lane]}
            byId={byId}
            startOpen={lane === 'now' || lanes.now.length === 0}
            onAdd={(t) => insert('tasks', { title: t, track_id: track.id, lane, sort: lanes[lane].length })}
            onRemove={(id) => confirm('Delete this task?') && remove('tasks', id)}
          />
        ))}
      </DndContext>

      {finished.length > 0 && (
        <Fold title="Done" count={finished.length}>
          <div className="list">
            {finished.map((t) => (
              <TaskRow key={t.id} task={t} showTrack={false} />
            ))}
          </div>
        </Fold>
      )}
    </div>
  )
}

// A lane is one droppable section; Later starts folded, and its header still accepts drops.
function LaneList({ lane, title, ids, byId, startOpen, onAdd, onRemove }: { lane: Lane; title: string; ids: string[]; byId: Map<string, Task>; startOpen: boolean; onAdd: (title: string) => void; onRemove: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: lane })
  const [open, setOpen] = useState(startOpen)
  return (
    <section ref={setNodeRef} className={`lane lane-${lane} ${isOver ? 'over' : ''}`}>
      <button className="fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={open ? 'down' : 'right'} size={16} />
        <h2>{title}</h2>
        <span className="count">{ids.length}</span>
      </button>
      {open && (
        <>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="list">
              {ids.map((id, i) => {
                const t = byId.get(id)
                return t ? <SortableTask key={id} task={t} next={lane === 'now' && i === 0} onRemove={() => onRemove(id)} /> : null
              })}
              {ids.length === 0 && <p className="lane-empty">Nothing here. Drag a task in or add one.</p>}
            </div>
          </SortableContext>
          <AddLine placeholder="Add a task" onAdd={onAdd} />
        </>
      )}
    </section>
  )
}

function SortableTask({ task, next, onRemove }: { task: Task; next: boolean; onRemove: () => void }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div ref={setNodeRef} className={`sortable ${isDragging ? 'dragging' : ''} ${next ? 'is-next' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }} {...listeners}>
      {next && <span className="next-tag">Next</span>}
      <TaskRow task={task} showTrack={false} onRemove={onRemove} />
    </div>
  )
}

export function Fold({ title, count, children, startOpen = false }: { title: string; count?: number; children: React.ReactNode; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <section className="fold">
      <button className="fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={open ? 'down' : 'right'} size={16} />
        <h2>{title}</h2>
        {count !== undefined && <span className="count">{count}</span>}
      </button>
      {open && children}
    </section>
  )
}

// ---------- Overview: one line per track, showing its next step ----------

function Overview() {
  const { data } = useStore()
  const tracks = sortedTracks(data.tracks).filter((t) => t.status !== 'done')
  const live = tracks.filter((t) => t.status === 'active')
  const resting = tracks.filter((t) => t.status !== 'active')
  return (
    <div className="panel tasks-panel">
      <header className="track-head">
        <h1>Next steps</h1>
      </header>
      {AREAS.map(({ area, label }) => {
        const list = live.filter((t) => t.area === area)
        if (!list.length) return null
        return (
          <section key={area} className="ov-area">
            <h2>{label}</h2>
            <div className="ov-list">
              {list.map((t) => (
                <OverviewTrack key={t.id} track={t} />
              ))}
            </div>
          </section>
        )
      })}
      {resting.length > 0 && (
        <Fold title="Paused & parked" count={resting.length}>
          <div className="ov-list">
            {resting.map((t) => (
              <OverviewTrack key={t.id} track={t} />
            ))}
          </div>
        </Fold>
      )}
    </div>
  )
}

function OverviewTrack({ track }: { track: Track }) {
  const { data } = useStore()
  const open = openTasks(data.tasks.filter((t) => t.track_id === track.id))
  const now = open.filter((t) => t.lane === 'now').sort(bySort)
  const next = now[0]
  return (
    <button className="ov-row" style={{ '--c': track.color } as React.CSSProperties} onClick={() => goTrack(track.id)}>
      <span className="dot" />
      <span className="ov-main">
        <span className="ov-name">{track.name}</span>
        <span className="ov-next">{next ? next.title : 'No next step set'}</span>
      </span>
      {next && <DueTag day={next.due_on} />}
      {now.length > 0 && <span className="count">{now.length}</span>}
      <Icon name="right" size={16} />
    </button>
  )
}
