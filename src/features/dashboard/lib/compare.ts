export interface Comparison {
  percent: number
  direction: 'up' | 'down' | 'flat'
}

export function compare(current: number, previous: number | null): Comparison | null {
  if (previous === null) return null
  if (previous === 0) return current === 0 ? { percent: 0, direction: 'flat' } : { percent: 100, direction: 'up' }
  const percent = ((current - previous) / Math.abs(previous)) * 100
  return { percent: Math.round(percent), direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat' }
}
