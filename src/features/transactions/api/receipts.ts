import { useQuery } from '@tanstack/react-query'
import { type Cents, cents } from '../../../shared/money/money'
import { supabase } from '../../../shared/supabase/client'

export interface ReceiptLine {
  productId: string
  name: string
  variant: string
  qty: number
  unitPriceCents: Cents
}

export interface Receipt {
  id: string
  receiptNumber: number
  register: string
  registerCode: string
  method: 'pin' | 'cash' | 'qr'
  ts: number
  lines: ReceiptLine[]
  subtotalCents: Cents
  discountCents: Cents
  totalCents: Cents
  receivedCents: Cents | null
  changeCents: Cents | null
}

interface ReceiptRow {
  id: string
  receipt_number: number
  created_at: string
  registers: { name: string; code: string } | null
  sales: {
    method: 'pin' | 'cash' | 'qr'
    subtotal_cents: number
    discount_cents: number
    total_cents: number
    received_cents: number | null
    sale_items: { product_id: string; name_snapshot: string; variant_snapshot: string; qty: number; unit_price_cents: number }[]
  } | null
}

function mapRow(row: ReceiptRow): Receipt | null {
  if (!row.sales) return null
  const received = row.sales.received_cents !== null ? cents(row.sales.received_cents) : null
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    register: row.registers?.name ?? '?',
    registerCode: row.registers?.code ?? '?',
    method: row.sales.method,
    ts: new Date(row.created_at).getTime(),
    lines: row.sales.sale_items.map((i) => ({
      productId: i.product_id,
      name: i.name_snapshot,
      variant: i.variant_snapshot,
      qty: i.qty,
      unitPriceCents: cents(i.unit_price_cents),
    })),
    subtotalCents: cents(row.sales.subtotal_cents),
    discountCents: cents(row.sales.discount_cents),
    totalCents: cents(row.sales.total_cents),
    receivedCents: received,
    changeCents: received !== null ? cents(received - row.sales.total_cents) : null,
  }
}

export function useReceipts() {
  return useQuery({
    queryKey: ['receipts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receipts')
        .select('id, receipt_number, created_at, registers(name, code), sales(method, subtotal_cents, discount_cents, total_cents, received_cents, sale_items(product_id, name_snapshot, variant_snapshot, qty, unit_price_cents))')
        .eq('kind', 'sale')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as unknown as ReceiptRow[]).map(mapRow).filter((r): r is Receipt => r !== null)
    },
  })
}
