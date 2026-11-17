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

// Back button: opening something (a track, a bucket, a page) adds a step to the phone's history;
// going back out and switching tabs replace the current step. So pressing back always ends up
// leaving the app instead of looping between views.
const push = (hash: string) => {
  location.hash = hash
  history.replaceState({ inApp: true }, '')
}
const replace = (hash: string) => location.replace(`#${hash}`)

export const goTrack = (id: string | null) => (id ? push(`t/${id}`) : replace(''))
export const goBucket = (id: string | null) => (id ? push(`i/${id}`) : replace('i'))
export const goPanel = (panel: Panel) => replace(`v/${panel}`)
export const goPage = (page: Page) => push(page)
// An in-app back link: step back if we opened this view, else go to its parent.
export const goBack = (parent: string) => (history.state?.inApp ? history.back() : replace(parent))
