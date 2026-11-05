import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/supabase/client'
import type { ImportPlan } from '../lib/excelImport'

async function createProduct(
  eventId: string,
  categoryIdByName: Map<string, string>,
  p: ImportPlan['newProducts'][number],
) {
  const categoryId = categoryIdByName.get(p.category.toLowerCase())
  if (!categoryId) throw new Error(`Onbekende categorie "${p.category}" — maak die eerst aan bij Instellingen`)

  const { data, error } = await supabase.rpc('create_product', {
    p_event_id: eventId,
    p_sku: p.sku,
    p_name: p.name,
    p_category_id: categoryId,
    p_variant: p.variant,
    p_price_cents: p.priceCents,
    p_cost_cents: p.costCents,
    p_min_stock: p.minStock,
    p_barcode: p.barcode,
  })
  if (error) throw error
  return data
}

async function updateProduct(categoryIdByName: Map<string, string>, p: ImportPlan['updatedProducts'][number]) {
  const categoryId = categoryIdByName.get(p.category.toLowerCase())
  if (!categoryId) throw new Error(`Onbekende categorie "${p.category}" — maak die eerst aan bij Instellingen`)

  const { error } = await supabase.rpc('update_product_details', {
    p_product_id: p.id,
    p_name: p.name,
    p_category_id: categoryId,
    p_variant: p.variant,
    p_price_cents: p.priceCents,
    p_cost_cents: p.costCents,
    p_min_stock: p.minStock,
    p_barcode: p.barcode,
    p_vat_rate_bp: null,
    p_active: true,
  })
  if (error) throw error
}

async function applyStockMovement(productId: string, delta: number, filename: string) {
  const { error } = await supabase.rpc('apply_stock_movement', {
    p_product_id: productId,
    p_delta: delta,
    p_reason: 'import',
    p_ref: filename,
  })
  if (error) throw error
}

export function useImportPlan(eventId: string, categoryIdByName: Map<string, string>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ plan, filename }: { plan: ImportPlan; filename: string }) => {
      const createdIds = new Map<string, string>() // sku -> product id

      for (const p of plan.newProducts) {
        const created = await createProduct(eventId, categoryIdByName, p)
        createdIds.set(p.sku.toLowerCase(), created.id)
      }

      for (const p of plan.updatedProducts) {
        await updateProduct(categoryIdByName, p)
      }

      for (const m of plan.movements) {
        const productId = m.productId ?? createdIds.get(m.sku.toLowerCase())
        if (!productId) continue
        await applyStockMovement(productId, m.delta, filename)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', eventId] }),
  })
}
