import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/supabase/client'

export interface CheckoutItem {
  product_id: string
  qty: number
  unit_price_cents: number
}

export interface CheckoutInput {
  registerId: string
  method: 'pin' | 'cash' | 'qr'
  items: CheckoutItem[]
  discountCents: number
  receivedCents: number | null
  creditCents?: number
  creditRefId?: string | null
  employeeId?: string | null
}

export async function checkoutSale(input: CheckoutInput) {
  const { data, error } = await supabase.rpc('checkout_sale', {
    p_register_id: input.registerId,
    p_method: input.method,
    p_items: input.items,
    p_discount_cents: input.discountCents,
    p_received_cents: input.receivedCents,
    p_credit_cents: input.creditCents ?? 0,
    p_credit_ref_id: input.creditRefId ?? null,
    p_employee_id: input.employeeId ?? null,
  })
  if (error) throw error
  return data[0]
}

export function useCheckout(eventId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: checkoutSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', eventId] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
  })
}
