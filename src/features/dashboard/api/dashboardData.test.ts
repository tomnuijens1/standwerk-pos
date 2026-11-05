import { describe, expect, it } from 'vitest'
import { cents } from '../../../shared/money/money'
import { computeByMethod, computeBySize, computeBestsellers, computeStats, type DashboardReceipt } from './dashboardData'

function sale(overrides: Partial<DashboardReceipt> = {}): DashboardReceipt {
  return {
    id: '1',
    kind: 'sale',
    receiptNumber: 1,
    createdAt: Date.UTC(2026, 10, 4, 12, 0, 0),
    registerName: 'Hoofdpodium',
    registerCode: 'HOO',
    method: 'pin',
    totalCents: 3500,
    discountCents: 0,
    paidCents: 3500,
    items: [
      {
        product_id: 'p1',
        name_snapshot: 'Tour Tee Zwart',
        variant_snapshot: 'M',
        category_snapshot: 'T-shirts',
        unit_price_cents: 3500,
        unit_cost_cents: 950,
        vat_rate_bp_snapshot: 2100,
        qty: 1,
      },
    ],
    ...overrides,
  }
}

function refund(overrides: Partial<DashboardReceipt> = {}): DashboardReceipt {
  return {
    id: '2',
    kind: 'refund',
    receiptNumber: 1,
    createdAt: Date.UTC(2026, 10, 4, 13, 0, 0),
    registerName: 'Hoofdpodium',
    registerCode: 'HOO',
    method: 'cash',
    totalCents: 3500,
    discountCents: 0,
    paidCents: 3500,
    items: [
      {
        product_id: 'p1',
        name_snapshot: 'Tour Tee Zwart',
        variant_snapshot: 'M',
        category_snapshot: 'T-shirts',
        refunded_unit_cents: 3500,
        unit_cost_cents: 950,
        vat_rate_bp_snapshot: 2100,
        qty: 1,
      },
    ],
    ...overrides,
  }
}

describe('computeStats', () => {
  it('berekent netto omzet als bruto minus retouren', () => {
    const stats = computeStats([sale(), sale({ id: '2' }), refund()])
    expect(stats.grossCents).toBe(cents(7000))
    expect(stats.refundsCents).toBe(cents(3500))
    expect(stats.netCents).toBe(cents(3500))
  })

  it('telt items netto (verkocht minus geretourneerd)', () => {
    const stats = computeStats([sale(), refund()])
    expect(stats.itemsCount).toBe(0)
  })

  it('berekent btw per regel i.p.v. één globaal tarief', () => {
    // 35,00 incl 21% btw -> 607 cent btw (zie shared/vat/vat.test.ts)
    const stats = computeStats([sale()])
    expect(stats.vatCents).toBe(cents(607))
  })

  it('berekent marge alleen als er inkoopprijzen bekend zijn', () => {
    const withCost = computeStats([sale()])
    expect(withCost.marginCents).not.toBeNull()

    const withoutCost = computeStats([sale({ items: [{ ...sale().items[0], unit_cost_cents: 0 } as never] })])
    expect(withoutCost.marginCents).toBeNull()
  })

  it('gemiddelde bon is bruto omzet gedeeld door aantal verkopen', () => {
    const stats = computeStats([sale({ totalCents: 3500 }), sale({ id: '2', totalCents: 5500 })])
    expect(stats.avgSaleCents).toBe(cents(4500))
  })
})

describe('computeByMethod', () => {
  it('telt omruilen niet mee als betaalmethode', () => {
    const result = computeByMethod([sale({ method: 'exchange', totalCents: 1000 })])
    expect(result.find((m) => m.method === 'exchange')).toBeUndefined()
    expect(result.every((m) => m.netCents === cents(0))).toBe(true)
  })

  it('trekt retouren af van de betaalmethode waarmee is terugbetaald', () => {
    const result = computeByMethod([sale({ method: 'cash', totalCents: 3500 }), refund({ method: 'cash', totalCents: 1000 })])
    expect(result.find((m) => m.method === 'cash')?.netCents).toBe(cents(2500))
  })
})

describe('computeBySize', () => {
  it('groepeert netto stuks per maat', () => {
    const result = computeBySize([sale(), sale({ id: '2', items: [{ ...sale().items[0], variant_snapshot: 'L', qty: 2 } as never] })])
    expect(result).toEqual([
      { variant: 'M', qty: 1 },
      { variant: 'L', qty: 2 },
    ])
  })

  it('negeert varianten die geen bekende maat zijn', () => {
    const result = computeBySize([sale({ items: [{ ...sale().items[0], variant_snapshot: 'Rood' } as never] })])
    expect(result).toEqual([])
  })
})

describe('computeBestsellers', () => {
  it('voegt varianten van hetzelfde product samen', () => {
    const result = computeBestsellers([
      sale({ items: [{ ...sale().items[0], variant_snapshot: 'S' } as never] }),
      sale({ id: '2', items: [{ ...sale().items[0], variant_snapshot: 'M' } as never] }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].qty).toBe(2)
  })
})
