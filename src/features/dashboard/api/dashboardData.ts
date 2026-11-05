import { addCents, type Cents, cents } from '../../../shared/money/money'
import { totalVatAmount, type VatRateBp } from '../../../shared/vat/vat'
import { supabase } from '../../../shared/supabase/client'
import { fetchProducts } from '../../pos/api/products'
import type { PeriodBounds } from '../lib/period'

export interface SaleItemRow {
  product_id: string
  name_snapshot: string
  variant_snapshot: string
  category_snapshot: string
  unit_price_cents: number
  unit_cost_cents: number
  vat_rate_bp_snapshot: number
  qty: number
}

export interface RefundItemRow {
  product_id: string
  name_snapshot: string
  variant_snapshot: string
  category_snapshot: string
  refunded_unit_cents: number
  unit_cost_cents: number
  vat_rate_bp_snapshot: number
  qty: number
}

export interface DashboardReceipt {
  id: string
  kind: 'sale' | 'refund'
  receiptNumber: number
  createdAt: number
  registerName: string
  registerCode: string
  method: string
  totalCents: number
  discountCents: number
  paidCents: number
  items: (SaleItemRow | RefundItemRow)[]
}

interface RawReceiptRow {
  id: string
  kind: 'sale' | 'refund'
  receipt_number: number
  created_at: string
  registers: { name: string; code: string } | null
  sales: { method: string; discount_cents: number; total_cents: number; paid_cents: number; sale_items: SaleItemRow[] } | null
  refunds: { method: string; total_cents: number; refund_items: RefundItemRow[] } | null
}

const RECEIPT_SELECT =
  'id, kind, receipt_number, created_at, registers(name, code), sales(method, discount_cents, total_cents, paid_cents, sale_items(product_id, name_snapshot, variant_snapshot, category_snapshot, unit_price_cents, unit_cost_cents, vat_rate_bp_snapshot, qty)), refunds(method, total_cents, refund_items(product_id, name_snapshot, variant_snapshot, category_snapshot, refunded_unit_cents, unit_cost_cents, vat_rate_bp_snapshot, qty))'

function mapRawReceipt(row: RawReceiptRow): DashboardReceipt | null {
  const booking = row.kind === 'sale' ? row.sales : row.refunds
  if (!booking) return null
  return {
    id: row.id,
    kind: row.kind,
    receiptNumber: row.receipt_number,
    createdAt: new Date(row.created_at).getTime(),
    registerName: row.registers?.name ?? '?',
    registerCode: row.registers?.code ?? '?',
    method: booking.method,
    totalCents: booking.total_cents,
    discountCents: row.kind === 'sale' ? (row.sales?.discount_cents ?? 0) : 0,
    paidCents: row.kind === 'sale' ? (row.sales?.paid_cents ?? 0) : booking.total_cents,
    items: row.kind === 'sale' ? row.sales!.sale_items : row.refunds!.refund_items,
  }
}

async function registerIdsForEvent(eventId: string): Promise<string[]> {
  const { data, error } = await supabase.from('registers').select('id').eq('event_id', eventId)
  if (error) throw error
  return (data ?? []).map((r) => r.id)
}

export async function fetchReceiptsInRange(eventId: string, fromMs: number, toMs: number): Promise<DashboardReceipt[]> {
  const registerIds = await registerIdsForEvent(eventId)
  if (registerIds.length === 0) return []

  const { data, error } = await supabase
    .from('receipts')
    .select(RECEIPT_SELECT)
    .in('register_id', registerIds)
    .gte('created_at', new Date(fromMs).toISOString())
    .lte('created_at', new Date(toMs).toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as unknown as RawReceiptRow[]).map(mapRawReceipt).filter((r): r is DashboardReceipt => r !== null)
}

/** Meest recente bonnen, ongeacht de geselecteerde dashboard-periode. */
export async function fetchRecentReceipts(eventId: string, limit = 8): Promise<DashboardReceipt[]> {
  const registerIds = await registerIdsForEvent(eventId)
  if (registerIds.length === 0) return []

  const { data, error } = await supabase
    .from('receipts')
    .select(RECEIPT_SELECT)
    .in('register_id', registerIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as unknown as RawReceiptRow[]).map(mapRawReceipt).filter((r): r is DashboardReceipt => r !== null)
}

export interface ForecastRow {
  productId: string
  name: string
  variant: string
  stock: number
  avgDailyQty: number
  daysLeft: number
}

/** Gemiddeld verkooptempo over de laatste 7 dagen (alle kassa's, vast venster
 * los van de gekozen dashboard-periode) en het aantal dagen voorraad dat er
 * nog is. */
export async function fetchStockForecast(eventId: string): Promise<ForecastRow[]> {
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const [receipts, products] = await Promise.all([fetchReceiptsInRange(eventId, sevenDaysAgo, now), fetchProducts(eventId)])

  const soldByProduct = new Map<string, number>()
  for (const r of receipts.filter((r) => r.kind === 'sale')) {
    for (const item of r.items) {
      soldByProduct.set(item.product_id, (soldByProduct.get(item.product_id) ?? 0) + item.qty)
    }
  }

  return products
    .map((p) => {
      const sold = soldByProduct.get(p.id) ?? 0
      const avgDailyQty = sold / 7
      return { productId: p.id, name: p.name, variant: p.variant, stock: p.stock, avgDailyQty, daysLeft: avgDailyQty > 0 ? p.stock / avgDailyQty : Number.POSITIVE_INFINITY }
    })
    .filter((r) => r.avgDailyQty > 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export interface DashboardStats {
  txCount: number
  netCents: Cents
  grossCents: Cents
  refundsCents: Cents
  refundsCount: number
  refundedItems: number
  discountCents: Cents
  discountPercentOfGross: number
  itemsCount: number
  vatCents: Cents
  avgSaleCents: Cents
  marginCents: Cents | null
}

function itemRevenue(item: SaleItemRow | RefundItemRow): number {
  return 'unit_price_cents' in item ? item.unit_price_cents * item.qty : item.refunded_unit_cents * item.qty
}

export function computeStats(receipts: DashboardReceipt[]): DashboardStats {
  const sales = receipts.filter((r) => r.kind === 'sale')
  const refunds = receipts.filter((r) => r.kind === 'refund')

  const grossCents = sales.length === 0 ? cents(0) : addCents(...sales.map((s) => cents(s.totalCents)))
  const refundsCents = refunds.length === 0 ? cents(0) : addCents(...refunds.map((r) => cents(r.totalCents)))
  const netCents = cents(grossCents - refundsCents)
  const discountCents = sales.length === 0 ? cents(0) : addCents(...sales.map((s) => cents(s.discountCents)))

  const soldItems = sales.reduce((n, s) => n + s.items.reduce((m, i) => m + i.qty, 0), 0)
  const refundedItems = refunds.reduce((n, r) => n + r.items.reduce((m, i) => m + i.qty, 0), 0)

  const hasCostData = receipts.some((r) => r.items.some((i) => i.unit_cost_cents > 0))
  const costSold = sales.reduce((n, s) => n + s.items.reduce((m, i) => m + i.unit_cost_cents * i.qty, 0), 0)
  const costRefunded = refunds.reduce((n, r) => n + r.items.reduce((m, i) => m + i.unit_cost_cents * i.qty, 0), 0)

  const vatFromSales = totalVatAmount(sales.flatMap((s) => s.items.map((i) => ({ amountIncl: cents(itemRevenue(i)), rate: i.vat_rate_bp_snapshot as VatRateBp }))))
  const vatFromRefunds = totalVatAmount(refunds.flatMap((r) => r.items.map((i) => ({ amountIncl: cents(itemRevenue(i)), rate: i.vat_rate_bp_snapshot as VatRateBp }))))
  const vatCents = cents(vatFromSales - vatFromRefunds)
  const netExCents = cents(netCents - vatCents)

  return {
    txCount: sales.length,
    netCents,
    grossCents,
    refundsCents,
    refundsCount: refunds.length,
    refundedItems,
    discountCents,
    discountPercentOfGross: grossCents > 0 ? (discountCents / grossCents) * 100 : 0,
    itemsCount: soldItems - refundedItems,
    vatCents,
    avgSaleCents: sales.length > 0 ? cents(Math.round(grossCents / sales.length)) : cents(0),
    marginCents: hasCostData ? cents(netExCents - (costSold - costRefunded)) : null,
  }
}

export interface RevenueBucket {
  label: string
  currentCents: Cents
  previousCents: Cents | null
}

export function computeRevenueSeries(current: DashboardReceipt[], previous: DashboardReceipt[], bounds: PeriodBounds): RevenueBucket[] {
  const net = (list: DashboardReceipt[]) => (list.length === 0 ? 0 : list.reduce((n, r) => n + (r.kind === 'sale' ? r.totalCents : -r.totalCents), 0))

  if (bounds.bucket === 'hour') {
    return Array.from({ length: 24 }, (_, hour) => {
      const bucketCurrent = current.filter((r) => new Date(r.createdAt).getHours() === hour)
      const bucketPrevious = previous.filter((r) => new Date(r.createdAt).getHours() === hour)
      return { label: `${hour}:00`, currentCents: cents(net(bucketCurrent)), previousCents: bounds.prevFrom !== null ? cents(net(bucketPrevious)) : null }
    })
  }

  const dayCount = Math.round((bounds.to - bounds.from) / (24 * 60 * 60 * 1000)) + 1
  const days = Array.from({ length: Math.min(dayCount, 31) }, (_, i) => {
    const dayStart = bounds.from + i * 24 * 60 * 60 * 1000
    return new Date(dayStart)
  })

  return days.map((day, i) => {
    const dayStart = day.getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000
    const bucketCurrent = current.filter((r) => r.createdAt >= dayStart && r.createdAt < dayEnd)
    const prevDayStart = (bounds.prevFrom ?? 0) + i * 24 * 60 * 60 * 1000
    const prevDayEnd = prevDayStart + 24 * 60 * 60 * 1000
    const bucketPrevious = previous.filter((r) => r.createdAt >= prevDayStart && r.createdAt < prevDayEnd)
    return {
      label: day.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
      currentCents: cents(net(bucketCurrent)),
      previousCents: bounds.prevFrom !== null ? cents(net(bucketPrevious)) : null,
    }
  })
}

export interface CategoryRevenue {
  category: string
  netCents: Cents
}

export function computeByCategory(receipts: DashboardReceipt[]): CategoryRevenue[] {
  const map = new Map<string, number>()
  for (const r of receipts) {
    const sign = r.kind === 'sale' ? 1 : -1
    for (const item of r.items) {
      map.set(item.category_snapshot, (map.get(item.category_snapshot) ?? 0) + sign * itemRevenue(item))
    }
  }
  return [...map.entries()].map(([category, net]) => ({ category, netCents: cents(net) })).sort((a, b) => b.netCents - a.netCents)
}

export interface BestsellerRow {
  name: string
  category: string
  netCents: Cents
  qty: number
}

export function computeBestsellers(receipts: DashboardReceipt[], limit = 6): BestsellerRow[] {
  const map = new Map<string, BestsellerRow>()
  for (const r of receipts) {
    const sign = r.kind === 'sale' ? 1 : -1
    for (const item of r.items) {
      const key = `${item.name_snapshot.toLowerCase()}::${item.category_snapshot.toLowerCase()}`
      const existing = map.get(key) ?? { name: item.name_snapshot, category: item.category_snapshot, netCents: cents(0), qty: 0 }
      existing.netCents = cents(existing.netCents + sign * itemRevenue(item))
      existing.qty += sign * item.qty
      map.set(key, existing)
    }
  }
  return [...map.values()].sort((a, b) => b.netCents - a.netCents).slice(0, limit)
}

export interface RegisterRevenue {
  register: string
  netCents: Cents
}

export function computeByRegister(receipts: DashboardReceipt[]): RegisterRevenue[] {
  const map = new Map<string, number>()
  for (const r of receipts) {
    const sign = r.kind === 'sale' ? 1 : -1
    map.set(r.registerName, (map.get(r.registerName) ?? 0) + sign * r.totalCents)
  }
  return [...map.entries()].map(([register, net]) => ({ register, netCents: cents(net) })).sort((a, b) => b.netCents - a.netCents)
}

export interface MethodRevenue {
  method: string
  netCents: Cents
}

const PAYMENT_METHODS = ['pin', 'cash', 'qr']

/** Omruiltegoed telt niet mee als betaalmethode (geen echt geld). */
export function computeByMethod(receipts: DashboardReceipt[]): MethodRevenue[] {
  const map = new Map<string, number>()
  for (const method of PAYMENT_METHODS) map.set(method, 0)
  for (const r of receipts) {
    if (!PAYMENT_METHODS.includes(r.method)) continue
    const sign = r.kind === 'sale' ? 1 : -1
    map.set(r.method, (map.get(r.method) ?? 0) + sign * r.totalCents)
  }
  return [...map.entries()].map(([method, net]) => ({ method, netCents: cents(net) }))
}

export interface SizeRow {
  variant: string
  qty: number
}

const SIZE_SET = new Set(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL'])

export function computeBySize(receipts: DashboardReceipt[]): SizeRow[] {
  const map = new Map<string, number>()
  for (const r of receipts) {
    const sign = r.kind === 'sale' ? 1 : -1
    for (const item of r.items) {
      const variant = item.variant_snapshot.toUpperCase()
      if (!SIZE_SET.has(variant)) continue
      map.set(variant, (map.get(variant) ?? 0) + sign * item.qty)
    }
  }
  return [...SIZE_SET].filter((s) => map.has(s)).map((variant) => ({ variant, qty: map.get(variant)! }))
}
