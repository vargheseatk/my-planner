import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Data, TableName } from './types'

const TABLES: TableName[] = ['tracks', 'principles', 'ideas', 'tasks', 'milestones', 'days', 'beliefs', 'outreach']
const EMPTY: Data = { tracks: [], principles: [], ideas: [], tasks: [], milestones: [], days: [], beliefs: [], outreach: [] }

type Row = { id: string }

interface Store {
  data: Data
  loading: boolean
  error: string | null
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

// The whole planner is small, so we load every table and reload on any realtime change
// (that is how pushes from Claude's CLI show up without a refresh).
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    const results = await Promise.all(TABLES.map((t) => supabase.from(t).select('*')))
    const next = { ...EMPTY } as Record<TableName, unknown[]>
    for (const [i, res] of results.entries()) {
      if (res.error) {
        setError(res.error.message)
        return
      }
      next[TABLES[i]] = res.data
    }
    setData(next as unknown as Data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('planner')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(load, 300)
      })
      .subscribe()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const patchLocal = useCallback((table: TableName, fn: (rows: Row[]) => Row[]) => {
    setData((d) => ({ ...d, [table]: fn(d[table] as Row[]) }))
  }, [])

  const store = useMemo<Store>(() => ({
    data,
    loading,
    error,
    clearError: () => setError(null),
    async insert(table, row) {
      const { data: created, error } = await supabase.from(table).insert(row as never).select().single()
      if (error) {
        setError(error.message)
        return null
      }
      patchLocal(table, (rows) => [...rows, created as Row])
      return created
    },
    async update(table, id, patch) {
      patchLocal(table, (rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      const { error } = await supabase.from(table).update(patch as never).eq('id', id)
      if (error) {
        setError(error.message)
        load()
      }
    },
    async updateMany(table, patches) {
      const byId = new Map(patches.map((p) => [p.id, p.patch]))
      patchLocal(table, (rows) => rows.map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r)))
      const results = await Promise.all(patches.map((p) => supabase.from(table).update(p.patch as never).eq('id', p.id)))
      const failed = results.find((r) => r.error)
      if (failed) {
        setError(failed.error!.message)
        load()
      }
    },
    async remove(table, id) {
      patchLocal(table, (rows) => rows.filter((r) => r.id !== id))
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) {
        setError(error.message)
        load()
      }
    },
  }), [data, loading, error, load, patchLocal])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
