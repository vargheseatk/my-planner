export const VIEWS = ['today', 'tracks', 'ideas', 'timeline', 'principles', 'settings'] as const
export type View = (typeof VIEWS)[number]

export const go = (view: View, id: string | null = null) => {
  location.hash = id ? `${view}/${id}` : view
}
