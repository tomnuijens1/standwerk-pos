import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type Cents, cents } from '../../../shared/money/money'
import { supabase } from '../../../shared/supabase/client'

export interface ReturnableItem {
  productId: string
  sku: string
  name: string
  variant: string
  unitPriceCents: Cents
  purchasedQty: number
  alreadyReturnedQty: number
  maxReturnableQty: number
}

export interface SaleForReturn {
  saleId: string
  receiptId: string
  registerCode: string
  receiptNumber: number
  createdAt: string
  method: 'pin' | 'cash' | 'qr'
  subtotalCents: Cents
  discountCents: Cents
  totalCents: Cents
  items: ReturnableItem[]
}

/**
 * Zoekt een verkoopbon op kassacode + bonnummer en berekent per regel hoeveel
 * er nog teruggenomen kan worden: gekocht minus wat al via eerdere retouren
 * is teruggenomen ("wat al geretourneerd is, telt mee").
 */
export async function fetchSaleForReturn(eventId: string, registerCode: string, receiptNumber: number): Promise<SaleForReturn | null> {
  const { data: register, error: regErr } = await supabase
    .from('registers')
    .select('id, code')
    .eq('event_id', eventId)
    .ilike('code', registerCode)
    .maybeSingle()
  if (regErr) throw regErr
  if (!register) return null

  const { data: receipt, error: recErr } = await supabase
    .from('receipts')
    .select(
      'id, receipt_number, created_at, sales(id, method, subtotal_cents, discount_cents, total_cents, sale_items(product_id, sku_snapshot, name_snapshot, variant_snapshot, unit_price_cents, qty))',
    )
    .eq('register_id', register.id)
    .eq('receipt_number', receiptNumber)
    .eq('kind', 'sale')
    .maybeSingle()
  if (recErr) throw recErr

  const sale = (receipt as unknown as { sales: Record<string, unknown> } | null)?.sales
  if (!receipt || !sale) return null

  const saleRow = sale as {
    id: string
    method: 'pin' | 'cash' | 'qr'
    subtotal_cents: number
    discount_cents: number
    total_cents: number
    sale_items: { product_id: string; sku_snapshot: string; name_snapshot: string; variant_snapshot: string; unit_price_cents: number; qty: number }[]
  }

  const { data: refunds, error: refErr } = await supabase.from('refunds').select('id').eq('ref_sale_id', saleRow.id)
  if (refErr) throw refErr
  const refundIds = (refunds ?? []).map((r) => r.id)

  const alreadyReturned = new Map<string, number>()
  if (refundIds.length > 0) {
    const { data: refundItems, error: itemsErr } = await supabase.from('refund_items').select('product_id, qty').in('refund_id', refundIds)
    if (itemsErr) throw itemsErr
    for (const it of refundItems ?? []) {
      alreadyReturned.set(it.product_id, (alreadyReturned.get(it.product_id) ?? 0) + it.qty)
    }
  }

  return {
    saleId: saleRow.id,
    receiptId: receipt.id,
    registerCode: register.code,
    receiptNumber: receipt.receipt_number,
    createdAt: receipt.created_at,
    method: saleRow.method,
    subtotalCents: cents(saleRow.subtotal_cents),
    discountCents: cents(saleRow.discount_cents),
    totalCents: cents(saleRow.total_cents),
    items: saleRow.sale_items.map((i) => {
      const already = alreadyReturned.get(i.product_id) ?? 0
      return {
        productId: i.product_id,
        sku: i.sku_snapshot,
        name: i.name_snapshot,
        variant: i.variant_snapshot,
        unitPriceCents: cents(i.unit_price_cents),
        purchasedQty: i.qty,
        alreadyReturnedQty: already,
        maxReturnableQty: Math.max(0, i.qty - already),
      }
    }),
  }
}

export interface CreateRefundInput {
  registerId: string
  method: 'pin' | 'cash' | 'qr' | 'exchange'
  reason: 'wrong_size' | 'defective' | 'unhappy' | 'mis_scanned' | 'other'
  restock: boolean
  refSaleId: string | null
  items: { product_id: string; qty: number; original_unit_price_cents: number; refunded_unit_cents: number }[]
  employeeId: string
}

export function useCreateRefund(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateRefundInput) => {
      const { data, error } = await supabase.rpc('create_refund', {
        p_register_id: input.registerId,
        p_method: input.method,
        p_reason: input.reason,
        p_restock: input.restock,
        p_ref_sale_id: input.refSaleId,
        p_items: input.items,
        p_employee_id: input.employeeId,
      })
      if (error) throw error
      return data[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', eventId] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
  })
}
