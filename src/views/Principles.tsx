import { goTrack } from '../nav'
import { useStore } from '../store'
import type { Principle } from '../types'
import { Icon } from '../components/icons'
import { AddLine, EditText, Section, sortedTracks } from '../components/ui'

export function Principles() {
  const { data, insert } = useStore()
  const global = data.principles.filter((p) => p.track_id === null).sort((a, b) => a.sort - b.sort)
  const perTrack = sortedTracks(data.tracks)
    .map((t) => ({ track: t, items: data.principles.filter((p) => p.track_id === t.id).sort((a, b) => a.sort - b.sort) }))
    .filter((g) => g.items.length)

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Principles</h1>
        <p className="lede">How you choose. One of these shows on Today each day, along with your focus track's own rules.</p>
      </header>
      <Section title="Life-wide">
        <div className="principles">
          {global.map((p) => (
            <PrincipleCard key={p.id} p={p} />
          ))}
        </div>
        <AddLine placeholder="Add a life-wide principle" onAdd={(title) => insert('principles', { title, track_id: null, sort: global.length })} />
      </Section>
      {perTrack.map(({ track, items }) => (
        <Section
          key={track.id}
          title={
            <button className="link-plain track-title" style={{ '--c': track.color } as React.CSSProperties} onClick={() => goTrack(track.id)}>
              <span className="dot" />
              {track.name}
            </button>
          }
        >
          <div className="principles">
            {items.map((p) => (
              <PrincipleCard key={p.id} p={p} color={track.color} />
            ))}
          </div>
        </Section>
      ))}
    </div>
  )
}

function PrincipleCard({ p, color }: { p: Principle; color?: string }) {
  const { update, remove } = useStore()
  return (
    <div className={`principle-full ${p.active ? '' : 'off'}`} style={{ '--c': color ?? 'var(--accent)' } as React.CSSProperties}>
      <EditText className="pf-title" value={p.title} onSave={(title) => title && update('principles', p.id, { title })} />
      <EditText multiline className="pf-body" value={p.body} placeholder="Why it matters, how to apply it" onSave={(body) => update('principles', p.id, { body: body || null })} />
      <div className="pf-actions">
        <button className="link small" onClick={() => update('principles', p.id, { active: !p.active })}>
          {p.active ? 'Retire' : 'Bring back'}
        </button>
        <button className="icon-btn ghost small" aria-label="Delete principle" onClick={() => confirm('Delete this principle?') && remove('principles', p.id)}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  )
}
