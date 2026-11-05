import type { Cents } from '../money/money'

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  categoryId: string
  variant: string
  vatRateBp: number
  priceCents: Cents
  costCents: Cents
  stock: number
  minStock: number | null
  barcode: string | null
  active: boolean
}
