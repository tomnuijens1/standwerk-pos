import { useQuery } from '@tanstack/react-query'
import { cents } from '../../../shared/money/money'
import type { Product } from '../../../shared/lib/product'
import { supabase } from '../../../shared/supabase/client'

interface ProductRow {
  id: string
  sku: string
  name: string
  category_id: string
  variant: string
  vat_rate_bp: number | null
  price_cents: number
  cost_cents: number
  stock: number
  min_stock: number | null
  barcode: string | null
  active: boolean
  categories: { name: string; default_vat_rate_bp: number } | null
}

function mapRow(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.categories?.name ?? 'Overig',
    categoryId: row.category_id,
    variant: row.variant,
    vatRateBp: row.vat_rate_bp ?? row.categories?.default_vat_rate_bp ?? 2100,
    priceCents: cents(row.price_cents),
    costCents: cents(row.cost_cents),
    stock: row.stock,
    minStock: row.min_stock,
    barcode: row.barcode,
    active: row.active,
  }
}

export async function fetchProducts(eventId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(name, default_vat_rate_bp)')
    .eq('event_id', eventId)
    .eq('active', true)
    .order('name')

  if (error) throw error
  return (data as ProductRow[]).map(mapRow)
}

export function useProducts(eventId: string | undefined) {
  return useQuery({
    queryKey: ['products', eventId],
    queryFn: () => fetchProducts(eventId!),
    enabled: !!eventId,
  })
}
