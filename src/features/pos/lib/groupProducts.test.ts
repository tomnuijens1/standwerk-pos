import { describe, expect, it } from 'vitest'
import { cents } from '../../../shared/money/money'
import type { Product } from '../../../shared/lib/product'
import { groupProducts } from './groupProducts'

function product(overrides: Partial<Product>): Product {
  return {
    id: overrides.id ?? Math.random().toString(),
    sku: 'SKU',
    name: 'Tour Tee Zwart',
    category: 'T-shirts',
    categoryId: 'cat-1',
    variant: '',
    vatRateBp: 2100,
    priceCents: cents(3500),
    costCents: cents(950),
    stock: 10,
    minStock: null,
    barcode: null,
    active: true,
    ...overrides,
  }
}

describe('groupProducts', () => {
  it('groepeert varianten met gelijke naam en categorie onder één groep', () => {
    const groups = groupProducts([
      product({ id: '1', variant: 'M' }),
      product({ id: '2', variant: 'L' }),
      product({ id: '3', variant: 'S' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((i) => i.variant)).toEqual(['S', 'M', 'L'])
  })

  it('houdt producten met verschillende naam of categorie gescheiden', () => {
    const groups = groupProducts([
      product({ id: '1', name: 'Tour Tee Zwart' }),
      product({ id: '2', name: 'Tour Hoodie Grijs', category: 'Hoodies' }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('telt de totale voorraad van de groep op', () => {
    const groups = groupProducts([
      product({ id: '1', variant: 'M', stock: 8 }),
      product({ id: '2', variant: 'L', stock: 0 }),
    ])
    expect(groups[0].totalStock).toBe(8)
  })

  it('een groep met één product heeft maar één item (geen keuzevenster nodig)', () => {
    const groups = groupProducts([product({ id: '1', name: 'Logo Cap', category: 'Accessoires', variant: '' })])
    expect(groups[0].items).toHaveLength(1)
  })
})
