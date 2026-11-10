import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/supabase/client'

export type StockMovementReason = 'sale' | 'return' | 'delivery' | 'count' | 'correction' | 'import' | 'manual'

export const REASON_LABELS: Record<StockMovementReason, string> = {
  sale: 'Verkoop',
  return: 'Retour',
  delivery: 'Levering',
  count: 'Telling',
  correction: 'Correctie',
  import: 'Import',
  manual: 'Handmatig',
}

export interface StockMovement {
  id: string
  createdAt: string
  sku: string
  name: string
  variant: string
  delta: number
  balanceAfter: number | null
  reason: StockMovementReason
  ref: string | null
  registerName: string | null
}

interface StockMovementRow {
  id: string
  created_at: string
  sku_snapshot: string
  name_snapshot: string
  variant_snapshot: string
  delta: number
  balance_after: number | null
  reason: StockMovementReason
  ref: string | null
  registers: { name: string } | null
}

export function useStockMovements(eventId: string) {
  return useQuery({
    queryKey: ['stockMovements', eventId],
    queryFn: async (): Promise<StockMovement[]> => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, created_at, sku_snapshot, name_snapshot, variant_snapshot, delta, balance_after, reason, ref, registers(name)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error
      return (data as unknown as StockMovementRow[]).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        sku: row.sku_snapshot,
        name: row.name_snapshot,
        variant: row.variant_snapshot,
        delta: row.delta,
        balanceAfter: row.balance_after,
        reason: row.reason,
        ref: row.ref,
        registerName: row.registers?.name ?? null,
      }))
    },
  })
}

export function useAdjustStock(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      productId: string
      delta: number
      reason: 'delivery' | 'count' | 'correction'
      ref: string | null
      employeeId?: string | null
    }) => {
      const { error } = await supabase.rpc('apply_stock_movement', {
        p_product_id: input.productId,
        p_delta: input.delta,
        p_reason: input.reason,
        p_ref: input.ref,
        p_employee_id: input.employeeId ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', eventId] })
      queryClient.invalidateQueries({ queryKey: ['stockMovements', eventId] })
    },
  })
}
