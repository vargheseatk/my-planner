import { useState } from 'react'
import { useStore } from '../store'
import type { Belief, BeliefKind } from '../types'
import { Icon } from '../components/icons'
import { AddLine, EditText, Section } from '../components/ui'

// Know myself: worldviews that actually drive what he does, noticed rather than decided,
// so the latest thing he read doesn't get mistaken for what he believes.
const KINDS: { kind: BeliefKind; title: string; add: string }[] = [
  { kind: 'belief', title: 'What I believe', add: 'I am a person who believes…' },
  { kind: 'tension', title: "Tensions I'm holding", add: 'Something I keep going back and forth on' },
]

export function Self() {
  const { data, insert } = useStore()
  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Know myself</h1>
        <p className="lede">The worldviews that actually drive what you do, not the last thing you read. Open one to see how it shows up.</p>
      </header>
      {KINDS.map(({ kind, title, add }) => {
        const list = data.beliefs.filter((b) => b.kind === kind).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
        return (
          <Section key={kind} title={title} count={list.length}>
            <div className="beliefs">
              {list.map((b) => (
                <BeliefCard key={b.id} b={b} />
              ))}
            </div>
            <AddLine placeholder={add} onAdd={(t) => insert('beliefs', { kind, title: t, sort: list.length })} />
          </Section>
        )
      })}
    </div>
  )
}

function BeliefCard({ b }: { b: Belief }) {
  const { update, remove } = useStore()
  const [open, setOpen] = useState(false)
  return (
    <div className={`belief ${b.kind} ${open ? 'open' : ''}`}>
      {!open ? (
        <button className="belief-head" aria-expanded={false} onClick={() => setOpen(true)}>
          <span className="belief-title">{b.title}</span>
          <Icon name="down" size={16} />
        </button>
      ) : (
        <div className="belief-body">
          <button className="icon-btn ghost small belief-close" aria-label="Collapse" onClick={() => setOpen(false)}>
            <Icon name="down" size={16} />
          </button>
          <EditText className="pf-title" value={b.title} onSave={(title) => title && update('beliefs', b.id, { title })} />
          <EditText multiline className="pf-body" value={b.body} placeholder="What you actually think, in your words" onSave={(body) => update('beliefs', b.id, { body: body || null })} />
          <h3 className="mini-head">{b.kind === 'belief' ? 'Shows up as' : 'Where it bites'}</h3>
          <EditText multiline className="pf-body" value={b.in_practice} placeholder="How it shows in what you do (or avoid)" onSave={(in_practice) => update('beliefs', b.id, { in_practice: in_practice || null })} />
          <div className="belief-actions">
            <button className="link small" onClick={() => update('beliefs', b.id, { kind: b.kind === 'belief' ? 'tension' : 'belief' })}>
              {b.kind === 'belief' ? 'Move to tensions' : 'Settled: move to beliefs'}
            </button>
            <button className="icon-btn ghost small" aria-label="Delete" onClick={() => confirm('Delete this?') && remove('beliefs', b.id)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
