import { useStore } from '../store'
import { AddLine, EditText, TrackChip } from '../components/ui'

export function Principles() {
  const { data, insert, update, remove } = useStore()
  const global = data.principles.filter((p) => p.track_id === null).sort((a, b) => a.sort - b.sort)
  const perTrack = data.tracks
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((t) => ({ track: t, items: data.principles.filter((p) => p.track_id === t.id).sort((a, b) => a.sort - b.sort) }))
    .filter((g) => g.items.length)

  return (
    <div className="view">
      <h1>Principles</h1>
      <p className="sub">Rules for every decision. They show on Today, along with the focus track's own principles.</p>
      <section>
        {global.map((p) => (
          <div key={p.id} className={`principle ${p.active ? '' : 'off'}`}>
            <EditText className="ptitle" value={p.title} onSave={(title) => title && update('principles', p.id, { title })} />
            <EditText multiline value={p.body} placeholder="Why / how to apply" onSave={(body) => update('principles', p.id, { body: body || null })} />
            <div className="row-end">
              <button className="link" onClick={() => update('principles', p.id, { active: !p.active })}>
                {p.active ? 'Retire' : 'Reactivate'}
              </button>
              <button className="x" aria-label="Delete principle" onClick={() => confirm('Delete this principle?') && remove('principles', p.id)}>
                ×
              </button>
            </div>
          </div>
        ))}
        <AddLine placeholder="Add a life-wide principle" onAdd={(title) => insert('principles', { title, track_id: null, sort: global.length })} />
      </section>
      {perTrack.map(({ track, items }) => (
        <section key={track.id}>
          <h2>
            <TrackChip track={track} />
          </h2>
          {items.map((p) => (
            <div key={p.id} className="principle compact">
              <b>{p.title}</b>
              {p.body && <p>{p.body}</p>}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
