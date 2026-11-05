import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useProducts } from '../pos/api/products'
import {
  computeByCategory,
  computeByMethod,
  computeByRegister,
  computeBySize,
  computeBestsellers,
  computeRevenueSeries,
  computeStats,
  fetchReceiptsInRange,
  fetchRecentReceipts,
  fetchStockForecast,
  type DashboardReceipt,
  type ForecastRow,
} from './api/dashboardData'
import { periodBounds, type DashboardRange } from './lib/period'

// Stabiele referentie i.p.v. een nieuwe `[]` bij elke render: anders verliezen
// de useMemo's hieronder hun memoization zolang de query nog laadt.
const EMPTY_RECEIPTS: DashboardReceipt[] = []
const EMPTY_FORECAST: ForecastRow[] = []

export function useDashboard(eventId: string, range: DashboardRange) {
  // Eén keer bij het laden van het dashboard vastgelegd (niet bij elke render
  // herberekend), zodat "nu" stabiel blijft terwijl je erdoorheen scrolt.
  const [now] = useState(() => Date.now())
  const bounds = useMemo(() => periodBounds(range, now), [range, now])

  const current = useQuery({
    queryKey: ['dashboard', eventId, 'current', bounds.from, bounds.to],
    queryFn: () => fetchReceiptsInRange(eventId, bounds.from, bounds.to),
  })
  const previous = useQuery({
    queryKey: ['dashboard', eventId, 'previous', bounds.prevFrom, bounds.prevTo],
    queryFn: () => fetchReceiptsInRange(eventId, bounds.prevFrom!, bounds.prevTo!),
    enabled: bounds.prevFrom !== null,
  })
  const recent = useQuery({ queryKey: ['dashboard', eventId, 'recent'], queryFn: () => fetchRecentReceipts(eventId) })
  const forecast = useQuery({ queryKey: ['dashboard', eventId, 'forecast'], queryFn: () => fetchStockForecast(eventId) })
  const { data: products = [] } = useProducts(eventId)

  const receipts = current.data ?? EMPTY_RECEIPTS
  const previousReceipts = previous.data ?? EMPTY_RECEIPTS

  const stats = useMemo(() => computeStats(receipts), [receipts])
  const previousStats = useMemo(() => (bounds.prevFrom !== null ? computeStats(previousReceipts) : null), [previousReceipts, bounds.prevFrom])
  const revenueSeries = useMemo(() => computeRevenueSeries(receipts, previousReceipts, bounds), [receipts, previousReceipts, bounds])
  const byCategory = useMemo(() => computeByCategory(receipts), [receipts])
  const bestsellers = useMemo(() => computeBestsellers(receipts), [receipts])
  const byRegister = useMemo(() => computeByRegister(receipts), [receipts])
  const byMethod = useMemo(() => computeByMethod(receipts), [receipts])
  const bySize = useMemo(() => computeBySize(receipts), [receipts])
  const lowStock = useMemo(() => products.filter((p) => p.stock === 0 || (p.minStock !== null && p.stock <= p.minStock)), [products])

  return {
    bounds,
    isLoading: current.isLoading,
    receipts,
    stats,
    previousStats,
    revenueSeries,
    byCategory,
    bestsellers,
    byRegister,
    byMethod,
    bySize,
    lowStock,
    recentReceipts: recent.data ?? EMPTY_RECEIPTS,
    stockForecast: forecast.data ?? EMPTY_FORECAST,
  }
}
