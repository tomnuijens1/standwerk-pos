export type DashboardRange = 'today' | '7d' | 'all'

export interface PeriodBounds {
  from: number
  to: number
  prevFrom: number | null
  prevTo: number | null
  previousLabel: string
  label: string
  bucket: 'hour' | 'day'
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Zelfde periode-indeling als het prototype (bounds()): "Vandaag" vergelijkt
 * met gisteren tot hetzelfde tijdstip, "7 dagen" met de 7 dagen daarvoor. */
export function periodBounds(range: DashboardRange, now: number): PeriodBounds {
  const sod = startOfDay(now)

  if (range === 'today') {
    return { from: sod, to: now, prevFrom: sod - DAY_MS, prevTo: now - DAY_MS, previousLabel: 'gisteren', label: 'Vandaag', bucket: 'hour' }
  }
  if (range === '7d') {
    return {
      from: sod - 6 * DAY_MS,
      to: now,
      prevFrom: sod - 13 * DAY_MS,
      prevTo: sod - 6 * DAY_MS,
      previousLabel: 'vorige 7 dagen',
      label: 'Afgelopen 7 dagen',
      bucket: 'day',
    }
  }
  return { from: 0, to: now, prevFrom: null, prevTo: null, previousLabel: '', label: 'Alles', bucket: 'day' }
}
