// All dates are local-calendar YYYY-MM-DD strings.
export const iso = (d: Date) => d.toLocaleDateString('en-CA')
export const todayIso = () => iso(new Date())

export function addDays(day: string, n: number) {
  const d = new Date(day + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return iso(d)
}

export function daysBetween(from: string, to: string) {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000)
}

export function fmtDay(day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(day + 'T00:00:00').toLocaleDateString('en-IN', opts)
}

export function relative(day: string, from = todayIso()) {
  const n = daysBetween(from, day)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n}d` : `${-n}d ago`
}

// Monday of the week containing day.
export function weekStart(day: string) {
  const d = new Date(day + 'T00:00:00')
  return addDays(day, -((d.getDay() + 6) % 7))
}
