// Hash routes: #  (overview), #t/<track id>, #ideas, #principles, #self, #settings.
// Anything else (e.g. an auth callback) falls back to the overview.
export type Page = 'ideas' | 'principles' | 'self' | 'settings'
export type Route = { page: 'board'; trackId: string | null } | { page: Page }

const PAGES: Page[] = ['ideas', 'principles', 'self', 'settings']

export function readHash(): Route {
  const [a, b] = location.hash.slice(1).split('/')
  if (a === 't' && b) return { page: 'board', trackId: b }
  if (PAGES.includes(a as Page)) return { page: a as Page }
  return { page: 'board', trackId: null }
}

export const goTrack = (id: string | null) => {
  location.hash = id ? `t/${id}` : ''
}
export const goPage = (page: Page) => {
  location.hash = page
}
