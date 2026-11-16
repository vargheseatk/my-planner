import { useState } from 'react'
import { useStore } from '../store'
import type { Idea, IdeaGroup } from '../types'
import { Icon } from '../components/icons'
import { AddLine, EditText, TrackTag, useUI } from '../components/ui'
import { SortableList, sortPatches } from '../components/Sortable'

// Ideas notebook: one-liners gathered under headings (a film, Reels, a business thought).
// Not tasks: an idea only becomes work when he taps "Make task".
const LIVE = new Set(['inbox', 'kept', 'parked'])
const COLORS = ['#c2562b', '#d0812f', '#3d8a55', '#2f8a8a', '#5b6fd6', '#8a5bd6', '#c2557a', '#8a7f72']
const bySort = (a: Idea, b: Idea) => a.sort - b.sort || b.created_at.localeCompare(a.created_at)
const OPEN_KEY = 'planner.ideas.open'

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const sortedGroups = (groups: IdeaGroup[]) => groups.slice().sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
export const unsortedIdeas = (ideas: Idea[]) => ideas.filter((i) => LIVE.has(i.status) && !i.group_id)

export function Ideas() {
  const { data, insert, updateMany } = useStore()
  const groups = sortedGroups(data.idea_groups)
  const live = data.ideas.filter((i) => LIVE.has(i.status))
  const unsorted = unsortedIdeas(data.ideas).sort(bySort)
  const letGo = data.ideas.filter((i) => i.status === 'dropped').sort((a, b) => b.created_at.localeCompare(a.created_at))
  const [text, setText] = useState('')
  const [addTo, setAddTo] = useState('')
  const [open, setOpenState] = useState(readOpen)
  const setOpen = (id: string, v: boolean) => {
    const next = { ...open, [id]: v }
    setOpenState(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
    } catch {
      /* private mode: folds just won't be remembered */
    }
  }

  // New ideas go to the top of their heading.
  const add = async (body: string, group_id: string | null) => {
    const top = Math.min(0, ...live.filter((i) => i.group_id === group_id).map((i) => i.sort)) - 1
    await insert('ideas', { body, group_id, sort: top })
  }
  const reorder = (next: Idea[]) => updateMany('ideas', sortPatches(next))

  return (
    <div className="panel ideas-panel">
      <form
        className="idea-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          add(text.trim(), addTo || null)
          setText('')
          if (addTo) setOpen(addTo, true)
        }}
      >
        <textarea
          data-primary-add
          rows={1}
          placeholder="Jot an idea…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <div className="idea-add-row">
          <label className="idea-to">
            under
            <select value={addTo} onChange={(e) => setAddTo(e.target.value)}>
              <option value="">Unsorted</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn small primary" disabled={!text.trim()}>
            Save
          </button>
        </div>
      </form>

      {unsorted.length > 0 && (
        <section className="idea-group">
          <div className="idea-group-head static">
            <h2>Unsorted</h2>
            <span className="count">{unsorted.length}</span>
          </div>
          <SortableList className="idea-list" items={unsorted} id={(i) => i.id} onReorder={reorder}>
            {(i, grip) => <IdeaRow idea={i} grip={grip} groups={groups} />}
          </SortableList>
        </section>
      )}

      <SortableList items={groups} id={(g) => g.id} onReorder={(next) => updateMany('idea_groups', sortPatches(next))}>
        {(g, grip) => {
          const items = live.filter((i) => i.group_id === g.id).sort(bySort)
          return <GroupSection group={g} grip={grip} items={items} groups={groups} open={!!open[g.id]} onToggle={() => setOpen(g.id, !open[g.id])} onAdd={(body) => add(body, g.id)} onReorder={reorder} />
        }}
      </SortableList>

      <AddLine placeholder="New heading (a film, Reels, a topic…)" onAdd={(name) => insert('idea_groups', { name, sort: groups.length, color: COLORS[groups.length % COLORS.length] })} />

      {letGo.length > 0 && (
        <section className="idea-group letgo">
          <button className="idea-group-head" aria-expanded={!!open.letgo} onClick={() => setOpen('letgo', !open.letgo)}>
            <Icon name={open.letgo ? 'down' : 'right'} size={16} />
            <h2>Let go</h2>
            <span className="count">{letGo.length}</span>
          </button>
          {open.letgo && (
            <div className="idea-list">
              {letGo.map((i) => (
                <IdeaRow key={i.id} idea={i} groups={groups} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function GroupSection({
  group,
  grip,
  items,
  groups,
  open,
  onToggle,
  onAdd,
  onReorder,
}: {
  group: IdeaGroup
  grip: React.ReactNode
  items: Idea[]
  groups: IdeaGroup[]
  open: boolean
  onToggle: () => void
  onAdd: (body: string) => void
  onReorder: (next: Idea[]) => void
}) {
  const { update, remove } = useStore()
  const [editing, setEditing] = useState(false)
  return (
    <section className="idea-group" style={{ '--c': group.color } as React.CSSProperties}>
      <div className="idea-group-top">
        {grip}
        <button className="idea-group-head" aria-expanded={open} onClick={onToggle}>
          <Icon name={open ? 'down' : 'right'} size={16} />
          <span className="dot" />
          <h2>{group.name}</h2>
          <span className="count">{items.length}</span>
        </button>
        <button className="icon-btn ghost small" aria-label={`Edit ${group.name}`} aria-expanded={editing} onClick={() => setEditing(!editing)}>
          <Icon name="more" size={16} />
        </button>
      </div>
      {editing && (
        <div className="idea-group-edit">
          <EditText className="boxed" value={group.name} onSave={(name) => name.trim() && update('idea_groups', group.id, { name: name.trim() })} />
          <div className="chips">
            {COLORS.map((c) => (
              <button key={c} className={`swatch ${group.color === c ? 'on' : ''}`} style={{ background: c }} aria-label="Colour" onClick={() => update('idea_groups', group.id, { color: c })} />
            ))}
          </div>
          <button className="btn small ghost" onClick={() => confirm(`Delete the heading "${group.name}"? Its ideas move to Unsorted.`) && remove('idea_groups', group.id)}>
            <Icon name="trash" size={14} /> Delete heading
          </button>
        </div>
      )}
      {open && (
        <>
          <AddLine placeholder={`Add to ${group.name}`} onAdd={onAdd} />
          <SortableList className="idea-list" items={items} id={(i) => i.id} onReorder={onReorder}>
            {(i, g) => <IdeaRow idea={i} grip={g} groups={groups} />}
          </SortableList>
        </>
      )}
    </section>
  )
}

function IdeaRow({ idea, grip, groups }: { idea: Idea; grip?: React.ReactNode; groups: IdeaGroup[] }) {
  const { data, insert, update, remove } = useStore()
  const { openTask } = useUI()
  const [actions, setActions] = useState(false)
  const track = data.tracks.find((t) => t.id === idea.track_id)
  const dropped = idea.status === 'dropped'
  // Moved ideas land on top of their new heading.
  const topSort = (group: string | null) => Math.min(0, ...data.ideas.filter((i) => i.group_id === group).map((i) => i.sort)) - 1

  const toTask = async () => {
    const created = await insert('tasks', { title: idea.body.slice(0, 140), notes: idea.body.length > 140 ? idea.body : null, track_id: idea.track_id })
    if (created) {
      update('ideas', idea.id, { status: 'converted' })
      openTask(created.id)
    }
  }

  return (
    <div className={`idea-row ${dropped ? 'dropped' : ''}`}>
      <div className="idea-line">
        {grip}
        <EditText multiline className="idea-text" value={idea.body} onSave={(body) => body.trim() && update('ideas', idea.id, { body: body.trim() })} />
        {track && <TrackTag track={track} />}
        <button className="icon-btn ghost small" aria-label="Idea actions" aria-expanded={actions} onClick={() => setActions(!actions)}>
          <Icon name="more" size={16} />
        </button>
      </div>
      {actions && (
        <div className="idea-actions-row">
          {dropped ? (
            <>
              <button className="btn small" onClick={() => update('ideas', idea.id, { status: 'inbox' })}>
                Bring back
              </button>
              <button className="btn small ghost" onClick={() => confirm('Delete forever?') && remove('ideas', idea.id)}>
                <Icon name="trash" size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              <label className="idea-to">
                Move to
                <select value={idea.group_id ?? ''} onChange={(e) => (update('ideas', idea.id, { group_id: e.target.value || null, sort: topSort(e.target.value || null) }), setActions(false))}>
                  <option value="">Unsorted</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn small" onClick={toTask}>
                Make task
              </button>
              <button className="btn small ghost" onClick={() => update('ideas', idea.id, { status: 'dropped' })}>
                Let go
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
