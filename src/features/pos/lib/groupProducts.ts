import type { Product } from '../../../shared/lib/product'
import { sortVariants } from '../../../shared/lib/sizeOrder'

export interface ProductGroup {
  key: string
  name: string
  category: string
  items: Product[]
  totalStock: number
  priceCents: Product['priceCents']
}

/** Varianten (maat/kleur) van hetzelfde product horen bij elkaar als naam EN
 * categorie gelijk zijn — net als in het prototype. */
export function groupProducts(products: Product[]): ProductGroup[] {
  const map = new Map<string, Product[]>()

  for (const p of products) {
    const key = `${p.name.toLowerCase()}::${p.category.toLowerCase()}`
    const existing = map.get(key)
    if (existing) existing.push(p)
    else map.set(key, [p])
  }

  return [...map.entries()].map(([key, items]) => {
    const sorted = sortVariants(items)
    return {
      key,
      name: sorted[0].name,
      category: sorted[0].category,
      items: sorted,
      totalStock: sorted.reduce((sum, p) => sum + p.stock, 0),
      priceCents: sorted[0].priceCents,
    }
  })
}
