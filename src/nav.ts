// Hash routes: #  (board), #t/<track id>, #i (idea buckets), #i/<bucket id | unsorted>, #v/<panel>,
// #principles, #self, #settings. Anything else (e.g. an auth callback) falls back to the board.
export type Page = 'principles' | 'self' | 'settings'
export type Panel = 'ideas' | 'tasks' | 'habits' | 'deadlines' | 'errands' | 'reach'
// bucket: undefined = not on ideas, null = the bucket list. panel: open this view (home-screen shortcuts).
export type Route = { page: 'board'; trackId: string | null; bucket?: string | null; panel?: Panel } | { page: Page }

const PAGES: Page[] = ['principles', 'self', 'settings']
const PANELS: Panel[] = ['ideas', 'tasks', 'habits', 'deadlines', 'errands', 'reach']

export function readHash(): Route {
  const [a, b] = location.hash.slice(1).split('/')
  if (a === 't' && b) return { page: 'board', trackId: b }
  if (a === 'i') return { page: 'board', trackId: null, bucket: b || null }
  if (a === 'v' && PANELS.includes(b as Panel)) return { page: 'board', trackId: null, panel: b as Panel }
  if (PAGES.includes(a as Page)) return { page: a as Page }
  return { page: 'board', trackId: null }
}

export const goTrack = (id: string | null) => {
  location.hash = id ? `t/${id}` : ''
}
export const goBucket = (id: string | null) => {
  location.hash = id ? `i/${id}` : 'i'
}
export const goPanel = (panel: Panel) => {
  location.hash = `v/${panel}`
}
export const goPage = (page: Page) => {
  location.hash = page
}
