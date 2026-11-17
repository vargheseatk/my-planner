import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Data, TableName } from './types'
import { addDays, todayIso } from './dates'

const TABLES: TableName[] = ['tracks', 'principles', 'ideas', 'tasks', 'milestones', 'days', 'beliefs', 'outreach', 'habits', 'habit_logs', 'settings', 'idea_groups']
const EMPTY: Data = { tracks: [], principles: [], ideas: [], tasks: [], milestones: [], days: [], beliefs: [], outreach: [], habits: [], habit_logs: [], settings: [], idea_groups: [] }

// Local-first: the app opens from the copy saved on the device, every change shows at once,
// and writes go through an outbox that keeps them (across restarts) until the server has them.
const CACHE_KEY = 'planner.cache.v1'
const OUTBOX_KEY = 'planner.outbox.v1'
const REFRESH_AFTER_MS = 60_000 // coming back to the app refreshes only if the data is older than this

// Column defaults from the migrations, so a row added offline looks complete before the server answers.
const DEFAULTS: Partial<Record<TableName, Record<string, unknown>>> = {
  tracks: { color: '#8a8a8a', status: 'active', area: 'personal', purpose: null, next_step: null, review_on: null, notes: null, sort: 0 },
  principles: { track_id: null, body: null, active: true, sort: 0 },
  ideas: { track_id: null, group_id: null, status: 'inbox', source: 'portal', sort: 0 },
  tasks: { track_id: null, notes: null, status: 'todo', waiting_on: null, start_on: null, due_on: null, priority: 2, lane: 'later', checklist: [], done_at: null, sort: 0 },
  milestones: { track_id: null, done: false, notes: null },
  beliefs: { kind: 'belief', body: null, in_practice: null, sort: 0 },
  outreach: { company: null, questions: null, draft: null, platform: null, status: 'draft', top: false, sent_on: null, notes: null, sort: 0 },
  habits: { principle: null, goal_count: null, color: '#3d8a55', active: true, sort: 0 },
  idea_groups: { color: '#8a7f72', sort: 0 },
}

type Row = { id: string }
type Op = { kind: 'insert'; table: TableName; row: Row } | { kind: 'update'; table: TableName; id: string; patch: object } | { kind: 'delete'; table: TableName; id: string }

interface Store {
  data: Data
  loading: boolean
  error: string | null
  // Changes made here that the server hasn't confirmed yet (offline or slow connection).
  pending: number
  insert: <T extends TableName>(table: T, row: Partial<Data[T][number]>) => Promise<Data[T][number] | null>
  update: <T extends TableName>(table: T, id: string, patch: Partial<Data[T][number]>) => Promise<void>
  remove: (table: TableName, id: string) => Promise<void>
  // Write several rows' changes at once (e.g. new sort order after a drag).
  updateMany: <T extends TableName>(table: T, patches: { id: string; patch: Partial<Data[T][number]> }[]) => Promise<void>
  clearError: () => void
}

const Ctx = createContext<Store | null>(null)

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the app still works, it just won't open offline */
  }
}
// Called on sign-out so the next person on this device sees nothing.
export function clearLocalData() {
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(OUTBOX_KEY)
  } catch {
    /* nothing stored */
  }
}

const isNetworkError = (message: string) => !navigator.onLine || /fetch|network|load failed|timed? ?out/i.test(message)

function applyOp(d: Data, op: Op): Data {
  const rows = d[op.table] as Row[]
  const next =
    op.kind === 'insert'
      ? [...rows.filter((r) => r.id !== op.row.id), op.row]
      : op.kind === 'update'
        ? rows.map((r) => (r.id === op.id ? { ...r, ...op.patch } : r))
        : rows.filter((r) => r.id !== op.id)
  return { ...d, [op.table]: next }
}

const select = (t: TableName) => (t === 'habit_logs' ? supabase.from(t).select('*').gte('day', addDays(todayIso(), -400)) : supabase.from(t).select('*'))

export function StoreProvider({ children }: { children: ReactNode }) {
  const cached = useRef(readJson<Data | null>(CACHE_KEY, null))
  const [data, setData] = useState<Data>(() => ({ ...EMPTY, ...cached.current }))
  const [loading, setLoading] = useState(!cached.current)
  const [error, setError] = useState<string | null>(null)
  const outbox = useRef<Op[]>(readJson<Op[]>(OUTBOX_KEY, []))
  const [pending, setPending] = useState(outbox.current.length)
  const flushing = useRef(false)
  const lastLoad = useRef(0)
  const timers = useRef<Partial<Record<TableName, number>>>({})

  // Server rows, with any not-yet-confirmed local changes laid on top.
  const withPending = useCallback((d: Data, only?: TableName) => outbox.current.filter((op) => !only || op.table === only).reduce(applyOp, d), [])

  const load = useCallback(async () => {
    const results = await Promise.all(TABLES.map(select))
    const bad = results.find((r) => r.error)
    if (bad) {
      if (!isNetworkError(bad.error!.message)) setError(bad.error!.message)
      setLoading(false) // keep showing the saved copy
      return
    }
    const next = { ...EMPTY } as Record<TableName, unknown[]>
    results.forEach((res, i) => (next[TABLES[i]] = res.data!))
    lastLoad.current = Date.now()
    setData(withPending(next as unknown as Data))
    setLoading(false)
  }, [withPending])

  const loadTable = useCallback(
    async (t: TableName) => {
      const res = await select(t)
      if (res.error) return
      setData((d) => withPending({ ...d, [t]: res.data }, t))
    },
    [withPending],
  )

  const saveOutbox = () => {
    writeJson(OUTBOX_KEY, outbox.current)
    setPending(outbox.current.length)
  }

  // Send queued changes in order. A network failure stops and waits for the next try;
  // a real refusal from the server drops that change and reloads its table.
  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (outbox.current.length) {
        const op = outbox.current[0]
        const res =
          op.kind === 'insert'
            ? await supabase.from(op.table).upsert(op.row as never).select().single()
            : op.kind === 'update'
              ? await supabase.from(op.table).update(op.patch as never).eq('id', op.id)
              : await supabase.from(op.table).delete().eq('id', op.id)
        if (res.error) {
          if (isNetworkError(res.error.message)) break
          setError(res.error.message)
          outbox.current.shift()
          saveOutbox()
          loadTable(op.table)
          continue
        }
        outbox.current.shift()
        saveOutbox()
        // The server fills in owner, timestamps and any defaults: keep its version of a new row.
        if (op.kind === 'insert' && res.data) setData((d) => withPending({ ...d, [op.table]: (d[op.table] as Row[]).map((r) => (r.id === op.row.id ? { ...r, ...(res.data as Row) } : r)) }, op.table))
      }
    } finally {
      flushing.current = false
    }
  }, [loadTable, withPending])

  const queue = useCallback(
    (ops: Op[]) => {
      setData((d) => ops.reduce(applyOp, d))
      outbox.current.push(...ops)
      saveOutbox()
      flush()
    },
    [flush],
  )

  // Keep the saved copy current, so the next open is instant.
  useEffect(() => {
    if (loading) return
    const t = window.setTimeout(() => writeJson(CACHE_KEY, data), 400)
    return () => window.clearTimeout(t)
  }, [data, loading])

  useEffect(() => {
    load()
    flush()
    // Realtime: refresh only the table that changed (that is how Claude's CLI pushes show up).
    const channel = supabase
      .channel('planner')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const t = payload.table as TableName
        if (!TABLES.includes(t)) return
        window.clearTimeout(timers.current[t])
        timers.current[t] = window.setTimeout(() => loadTable(t), 300)
      })
      .subscribe()
    const onFocus = () => {
      flush()
      if (Date.now() - lastLoad.current > REFRESH_AFTER_MS) load()
    }
    const onOnline = () => (flush(), load())
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    const retry = window.setInterval(() => outbox.current.length && flush(), 20_000)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
      window.clearInterval(retry)
    }
  }, [load, loadTable, flush])

  const store = useMemo<Store>(
    () => ({
      data,
      loading,
      error,
      pending,
      clearError: () => setError(null),
      async insert(table, row) {
        const full = { ...DEFAULTS[table], ...row, id: (row as Partial<Row>).id ?? crypto.randomUUID(), created_at: new Date().toISOString() } as unknown as Row
        queue([{ kind: 'insert', table, row: full }])
        return full as never
      },
      async update(table, id, patch) {
        queue([{ kind: 'update', table, id, patch }])
      },
      async updateMany(table, patches) {
        queue(patches.map((p) => ({ kind: 'update' as const, table, id: p.id, patch: p.patch })))
      },
      async remove(table, id) {
        queue([{ kind: 'delete', table, id }])
      },
    }),
    [data, loading, error, pending, queue],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
