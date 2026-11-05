import { useState } from 'react'
import { todayIso } from '../dates'
import { useStore } from '../store'
import type { Outreach, OutreachStatus } from '../types'
import { Icon } from '../components/icons'
import { EditText } from '../components/ui'
import { Fold } from './Tasks'
import { SortableList, sortPatches } from '../components/Sortable'

const PLATFORMS = ['LinkedIn', 'Email', 'WhatsApp', 'Instagram', 'X', 'Call']
const STATUSES: { value: OutreachStatus; label: string }[] = [
  { value: 'draft', label: 'Drafting' },
  { value: 'sent', label: 'Sent' },
  { value: 'replied', label: 'Replied' },
  { value: 'done', label: 'Done' },
]
const bySort = (a: Outreach, b: Outreach) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)

// Reach out: people to contact, what to ask them, the message and where it goes.
export function Reach() {
  const { data, insert, updateMany } = useStore()
  const [name, setName] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const all = data.outreach
  const groups: [string, Outreach[]][] = [
    ['To send', all.filter((o) => o.status === 'draft').sort(bySort)],
    ['Waiting to hear back', all.filter((o) => o.status === 'sent').sort(bySort)],
    ['Replied', all.filter((o) => o.status === 'replied').sort(bySort)],
  ]
  const done = all.filter((o) => o.status === 'done')

  const add = async () => {
    const n = name.trim()
    if (!n) return
    setName('')
    const row = await insert('outreach', { name: n, sort: groups[0][1].length })
    if (row) setOpenId(row.id)
  }

  const list = (rows: Outreach[]) => (
    <SortableList className="reach-list" items={rows} id={(o) => o.id} onReorder={(next) => updateMany('outreach', sortPatches(next))}>
      {(o, grip) => <ReachCard o={o} grip={grip} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} />}
    </SortableList>
  )

  return (
    <div className="panel reach-panel">
      <div className="panel-head">
        <h2>
          Reach out <span className="count">{all.length - done.length}</span>
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
          <input placeholder="Who do you want to reach out to?" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </form>
      {groups.map(
        ([label, rows]) =>
          rows.length > 0 && (
            <section key={label} className="errand-group">
              <h3 className="mini-head">{label}</h3>
              {list(rows)}
            </section>
          ),
      )}
      {all.length === done.length && <p className="lane-empty">Nobody on the list. Add a name above.</p>}
      {done.length > 0 && (
        <Fold title="Done" count={done.length}>
          {list(done.sort(bySort))}
        </Fold>
      )}
    </div>
  )
}

function ReachCard({ o, grip, open, onToggle }: { o: Outreach; grip: React.ReactNode; open: boolean; onToggle: () => void }) {
  const { update, remove } = useStore()
  const [copied, setCopied] = useState(false)
  const set = (patch: Partial<Outreach>) => update('outreach', o.id, patch)
  const setStatus = (status: OutreachStatus) => set(status === 'sent' && !o.sent_on ? { status, sent_on: todayIso() } : { status })
  const copy = async () => {
    await navigator.clipboard.writeText(o.draft ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`reach ${open ? 'open' : ''}`}>
      <div className="reach-top">
      {grip}
      <button className="reach-head" aria-expanded={open} onClick={onToggle}>
        <span className="reach-who">
          <span className="reach-name">{o.name}</span>
          {o.company && <span className="reach-co">{o.company}</span>}
        </span>
        {o.platform && <span className="pill">{o.platform}</span>}
        <Icon name="down" size={16} />
      </button>
      </div>
      {open && (
        <div className="reach-body">
          <div className="field-row">
            <label className="field">
              <span>Name</span>
              <EditText value={o.name} onSave={(name) => name && set({ name })} />
            </label>
            <label className="field">
              <span>Company</span>
              <EditText value={o.company} placeholder="Where they work" onSave={(company) => set({ company: company || null })} />
            </label>
          </div>
          <label className="field">
            <span>What I want to know from them</span>
            <EditText multiline value={o.questions} placeholder="The questions you want to ask" onSave={(questions) => set({ questions: questions || null })} />
          </label>
          <div className="field">
            <span className="field-head">
              Message draft
              {o.draft && (
                <button type="button" className="link small" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </span>
            <EditText multiline className="reach-draft" value={o.draft} placeholder="The message you'll send" onSave={(draft) => set({ draft: draft || null })} />
          </div>
          <div className="field">
            <span>Sending on</span>
            <div className="chips">
              {PLATFORMS.map((p) => (
                <button key={p} type="button" className={`chip-btn small ${o.platform === p ? 'on' : ''}`} onClick={() => set({ platform: o.platform === p ? null : p })}>
                  {p}
                </button>
              ))}
              {o.platform && !PLATFORMS.includes(o.platform) && <span className="chip-btn small on">{o.platform}</span>}
            </div>
          </div>
          <div className="field">
            <span>Status{o.sent_on && o.status !== 'draft' ? ` · sent ${o.sent_on}` : ''}</span>
            <div className="chips">
              {STATUSES.map((s) => (
                <button key={s.value} type="button" className={`chip-btn small ${o.status === s.value ? 'on' : ''}`} onClick={() => setStatus(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {o.status !== 'draft' && (
            <label className="field">
              <span>What came of it</span>
              <EditText multiline value={o.notes} placeholder="Their reply, what you learnt, next step" onSave={(notes) => set({ notes: notes || null })} />
            </label>
          )}
          <div className="belief-actions">
            <span />
            <button className="icon-btn ghost small" aria-label="Delete" onClick={() => confirm(`Delete ${o.name}?`) && remove('outreach', o.id)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
