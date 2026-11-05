import { useQuery } from '@tanstack/react-query'
import { addCents, type Cents, cents } from '../../../shared/money/money'
import { totalVatAmount, type VatRateBp } from '../../../shared/vat/vat'
import { supabase } from '../../../shared/supabase/client'

export interface MethodBreakdown {
  method: string
  inCents: Cents
  outCents: Cents
  netCents: Cents
  count: number
}

export interface ClosingSummary {
  txCount: number
  netCents: Cents
  grossCents: Cents
  refundsCents: Cents
  discountCents: Cents
  vatCents: Cents
  itemsCount: number
  methods: MethodBreakdown[]
  cashInCents: Cents
  cashOutCents: Cents
}

interface SaleRow {
  method: string
  total_cents: number
  discount_cents: number
  paid_cents: number
  credit_cents: number
  sale_items: { qty: number; unit_price_cents: number; vat_rate_bp_snapshot: number }[]
}

interface RefundRow {
  method: string
  total_cents: number
  refund_items: { qty: number; refunded_unit_cents: number; vat_rate_bp_snapshot: number }[]
}

/**
 * Netto omzet, btw en per-betaalmethode-uitsplitsing voor een dag (en kassa of
 * "alle kassa's"), volgens dezelfde rekenregels als het prototype
 * (closingData()/stats() in standwerk-pos.html), maar met btw per regel i.p.v.
 * één globaal tarief: elk sale_item/refund_item heeft zijn eigen
 * vat_rate_bp_snapshot vastgelegd op het moment van de boeking.
 */
export async function fetchClosingSummary(eventId: string, registerId: string | null, dateStr: string): Promise<ClosingSummary> {
  const dayStart = new Date(`${dateStr}T00:00:00`)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const { data: registers, error: regErr } = await supabase.from('registers').select('id').eq('event_id', eventId)
  if (regErr) throw regErr
  const registerIds = registerId ? [registerId] : (registers ?? []).map((r) => r.id)

  if (registerIds.length === 0) {
    return { txCount: 0, netCents: cents(0), grossCents: cents(0), refundsCents: cents(0), discountCents: cents(0), vatCents: cents(0), itemsCount: 0, methods: [], cashInCents: cents(0), cashOutCents: cents(0) }
  }

  const { data: receipts, error } = await supabase
    .from('receipts')
    .select(
      'id, kind, created_at, sales(method, total_cents, discount_cents, paid_cents, credit_cents, sale_items(qty, unit_price_cents, vat_rate_bp_snapshot)), refunds(method, total_cents, refund_items(qty, refunded_unit_cents, vat_rate_bp_snapshot))',
    )
    .in('register_id', registerIds)
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString())

  if (error) throw error

  const sales = (receipts ?? [])
    .filter((r) => r.kind === 'sale')
    .map((r) => (r as unknown as { sales: SaleRow }).sales)
    .filter(Boolean)
  const refunds = (receipts ?? [])
    .filter((r) => r.kind === 'refund')
    .map((r) => (r as unknown as { refunds: RefundRow }).refunds)
    .filter(Boolean)

  const grossCents = sales.length === 0 ? cents(0) : addCents(...sales.map((s) => cents(s.total_cents)))
  const refundsCents = refunds.length === 0 ? cents(0) : addCents(...refunds.map((r) => cents(r.total_cents)))
  const netCents = cents(grossCents - refundsCents)
  const discountCents = sales.length === 0 ? cents(0) : addCents(...sales.map((s) => cents(s.discount_cents)))

  const soldItems = sales.reduce((sum, s) => sum + s.sale_items.reduce((n, i) => n + i.qty, 0), 0)
  const returnedItems = refunds.reduce((sum, r) => sum + r.refund_items.reduce((n, i) => n + i.qty, 0), 0)
  const itemsCount = soldItems - returnedItems

  const vatFromSales = totalVatAmount(
    sales.flatMap((s) => s.sale_items.map((i) => ({ amountIncl: cents(i.unit_price_cents * i.qty), rate: i.vat_rate_bp_snapshot as VatRateBp }))),
  )
  const vatFromRefunds = totalVatAmount(
    refunds.flatMap((r) => r.refund_items.map((i) => ({ amountIncl: cents(i.refunded_unit_cents * i.qty), rate: i.vat_rate_bp_snapshot as VatRateBp }))),
  )
  const vatCents = cents(vatFromSales - vatFromRefunds)

  const methodMap = new Map<string, MethodBreakdown>()
  const getBucket = (method: string): MethodBreakdown => {
    const existing = methodMap.get(method)
    if (existing) return existing
    const fresh: MethodBreakdown = { method, inCents: cents(0), outCents: cents(0), netCents: cents(0), count: 0 }
    methodMap.set(method, fresh)
    return fresh
  }

  for (const sale of sales) {
    const bucket = getBucket(sale.method)
    bucket.inCents = cents(bucket.inCents + sale.paid_cents)
    bucket.count += 1
    if (sale.credit_cents > 0) {
      const creditBucket = getBucket('omruil')
      creditBucket.inCents = cents(creditBucket.inCents + sale.credit_cents)
    }
  }
  for (const refund of refunds) {
    const bucket = getBucket(refund.method)
    bucket.outCents = cents(bucket.outCents + refund.total_cents)
    bucket.count += 1
  }
  for (const bucket of methodMap.values()) {
    bucket.netCents = cents(bucket.inCents - bucket.outCents)
  }

  const cashBucket = methodMap.get('cash')

  return {
    txCount: sales.length,
    netCents,
    grossCents,
    refundsCents,
    discountCents,
    vatCents,
    itemsCount,
    methods: [...methodMap.values()],
    cashInCents: cashBucket?.inCents ?? cents(0),
    cashOutCents: cashBucket?.outCents ?? cents(0),
  }
}

export function useClosingSummary(eventId: string, registerId: string | null, dateStr: string) {
  return useQuery({
    queryKey: ['closingSummary', eventId, registerId, dateStr],
    queryFn: () => fetchClosingSummary(eventId, registerId, dateStr),
  })
}

export async function saveClosing(input: {
  eventId: string
  registerId: string | null
  date: string
  openingFloatCents: number
  expectedCents: number
  countedCents: number
  diffCents: number
  summary: ClosingSummary
  note: string
}) {
  const { error } = await supabase.from('closings').insert({
    event_id: input.eventId,
    register_id: input.registerId,
    date: input.date,
    opening_float_cents: input.openingFloatCents,
    expected_cents: input.expectedCents,
    counted_cents: input.countedCents,
    diff_cents: input.diffCents,
    tx_count: input.summary.txCount,
    net_cents: input.summary.netCents,
    gross_cents: input.summary.grossCents,
    refunds_cents: input.summary.refundsCents,
    discount_cents: input.summary.discountCents,
    vat_cents: input.summary.vatCents,
    items_count: input.summary.itemsCount,
    methods: Object.fromEntries(input.summary.methods.map((m) => [m.method, { in: m.inCents, out: m.outCents, n: m.count }])),
    note: input.note || null,
  })
  if (error) throw error
}
