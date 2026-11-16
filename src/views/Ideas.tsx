import { useEffect, useRef, useState } from 'react'
import { goBucket } from '../nav'
import { useStore } from '../store'
import type { Idea, IdeaGroup } from '../types'
import { Icon } from '../components/icons'
import { AddLine, EditText, useUI } from '../components/ui'
import { SortableList, sortPatches } from '../components/Sortable'

// Ideas notebook: one-liners kept in buckets (a film, Reels, a business thought), like tracks hold tasks.
// Not tasks: an idea only becomes work when he taps "Make task".
// The list shows the buckets; tapping one opens it with the add box ready, so jotting is tap, type, Enter.
const LIVE = new Set(['inbox', 'kept', 'parked'])
const COLORS = ['#c2562b', '#d0812f', '#3d8a55', '#2f8a8a', '#5b6fd6', '#8a5bd6', '#c2557a', '#8a7f72']
const UNSORTED = 'unsorted'
const bySort = (a: Idea, b: Idea) => a.sort - b.sort || b.created_at.localeCompare(a.created_at)

export const sortedGroups = (groups: IdeaGroup[]) => groups.slice().sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
export const unsortedIdeas = (ideas: Idea[]) => ideas.filter((i) => LIVE.has(i.status) && !i.group_id)
const liveIn = (ideas: Idea[], group: string | null) => ideas.filter((i) => LIVE.has(i.status) && i.group_id === group).sort(bySort)
// New and moved ideas land on top of their bucket.
const topSort = (ideas: Idea[], group: string | null) => Math.min(0, ...ideas.filter((i) => i.group_id === group).map((i) => i.sort)) - 1

export function Ideas({ bucket }: { bucket: string | null }) {
  const { data } = useStore()
  if (bucket === UNSORTED) return <Bucket group={null} />
  const group = data.idea_groups.find((g) => g.id === bucket)
  return group ? <Bucket key={group.id} group={group} /> : <Buckets />
}

// ---------- The bucket list ----------

function Buckets() {
  const { data, insert, updateMany } = useStore()
  const groups = sortedGroups(data.idea_groups)
  const unsorted = liveIn(data.ideas, null)
  const [showGone, setShowGone] = useState(false)
  const gone = data.ideas.filter((i) => i.status === 'dropped').sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="panel ideas-panel">
      <header className="track-head">
        <h1>Ideas</h1>
      </header>
      <div className="bucket-list">
        <BucketCard id={UNSORTED} name="Unsorted" color="var(--muted)" ideas={unsorted} />
        <SortableList items={groups} id={(g) => g.id} onReorder={(next) => updateMany('idea_groups', sortPatches(next))}>
          {(g, grip) => <BucketCard id={g.id} name={g.name} color={g.color} ideas={liveIn(data.ideas, g.id)} grip={grip} />}
        </SortableList>
      </div>
      <AddLine placeholder="New bucket (a film, Reels, a topic…)" onAdd={(name) => insert('idea_groups', { name, sort: groups.length, color: COLORS[groups.length % COLORS.length] })} />

      {gone.length > 0 && (
        <section className="idea-group letgo">
          <button className="idea-group-head" aria-expanded={showGone} onClick={() => setShowGone(!showGone)}>
            <Icon name={showGone ? 'down' : 'right'} size={16} />
            <h2>Let go</h2>
            <span className="count">{gone.length}</span>
          </button>
          {showGone && (
            <div className="idea-list">
              {gone.map((i) => (
                <IdeaRow key={i.id} idea={i} groups={groups} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function BucketCard({ id, name, color, ideas, grip }: { id: string; name: string; color: string; ideas: Idea[]; grip?: React.ReactNode }) {
  return (
    <div className="bucket-item" style={{ '--c': color } as React.CSSProperties}>
      {grip ?? <span className="grip-space" />}
      <button className="bucket-card" onClick={() => goBucket(id)}>
        <span className="dot" />
        <span className="ov-main">
          <span className="ov-name">{name}</span>
          <span className="ov-next">{ideas[0]?.body ?? 'Empty. Tap to add an idea'}</span>
        </span>
        {ideas.length > 0 && <span className="count">{ideas.length}</span>}
        <Icon name="right" size={16} />
      </button>
    </div>
  )
}

// ---------- One bucket: add box on top, its ideas below ----------

function Bucket({ group }: { group: IdeaGroup | null }) {
  const { data, insert, update, remove, updateMany } = useStore()
  const groups = sortedGroups(data.idea_groups)
  const ideas = liveIn(data.ideas, group?.id ?? null)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const name = group?.name ?? 'Unsorted'

  // Opening a bucket means "I have an idea": put the cursor in the box.
  useEffect(() => box.current?.focus(), [])

  const save = () => {
    const body = text.trim()
    if (!body) return
    insert('ideas', { body, group_id: group?.id ?? null, sort: topSort(data.ideas, group?.id ?? null) })
    setText('')
    box.current?.focus()
  }

  return (
    <div className="panel ideas-panel" style={{ '--c': group?.color ?? 'var(--muted)' } as React.CSSProperties}>
      <button className="link-plain bucket-back" onClick={() => goBucket(null)}>
        <Icon name="left" size={16} /> Ideas
      </button>
      <header className="track-head">
        <span className="dot big" />
        <h1>{name}</h1>
        {group && (
          <button className="icon-btn" aria-label="Bucket settings" aria-expanded={editing} onClick={() => setEditing(!editing)}>
            <Icon name="more" />
          </button>
        )}
      </header>
      {group && editing && (
        <div className="idea-group-edit">
          <EditText className="boxed" value={group.name} onSave={(n) => n.trim() && update('idea_groups', group.id, { name: n.trim() })} />
          <div className="chips">
            {COLORS.map((c) => (
              <button key={c} className={`swatch ${group.color === c ? 'on' : ''}`} style={{ background: c }} aria-label="Colour" onClick={() => update('idea_groups', group.id, { color: c })} />
            ))}
          </div>
          <button className="btn small ghost" onClick={() => confirm(`Delete the bucket "${group.name}"? Its ideas move to Unsorted.`) && (remove('idea_groups', group.id), goBucket(null))}>
            <Icon name="trash" size={14} /> Delete bucket
          </button>
        </div>
      )}

      <form
        className="idea-add"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <textarea
          ref={box}
          data-primary-add
          rows={1}
          placeholder={`An idea for ${name}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
          }}
        />
        <button className="btn small primary" disabled={!text.trim()}>
          Save
        </button>
      </form>

      <SortableList className="idea-list" items={ideas} id={(i) => i.id} onReorder={(next) => updateMany('ideas', sortPatches(next))}>
        {(i, grip) => <IdeaRow idea={i} grip={grip} groups={groups} />}
      </SortableList>
      {ideas.length === 0 && <p className="lane-empty">Nothing here yet.</p>}
    </div>
  )
}

function IdeaRow({ idea, grip, groups }: { idea: Idea; grip?: React.ReactNode; groups: IdeaGroup[] }) {
  const { data, insert, update, remove } = useStore()
  const { openTask } = useUI()
  const [actions, setActions] = useState(false)
  const dropped = idea.status === 'dropped'

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
                <select
                  value={idea.group_id ?? ''}
                  onChange={(e) => {
                    const to = e.target.value || null
                    update('ideas', idea.id, { group_id: to, sort: topSort(data.ideas, to) })
                    setActions(false)
                  }}
                >
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
