import { describe, expect, it } from 'vitest'
import { cents } from '../../../shared/money/money'
import { buildImportPlan, detectColumnMapping, type ExistingProduct, parseImportRows } from './excelImport'

describe('detectColumnMapping', () => {
  it('herkent "Artikelnummer" als sku en "Verkoopprijs" als price', () => {
    const mapping = detectColumnMapping(['Artikelnummer', 'Naam', 'Verkoopprijs'])
    expect(mapping.sku).toBe(0)
    expect(mapping.name).toBe(1)
    expect(mapping.price).toBe(2)
  })

  it('herkent "Maat" als variant en "Inkoopprijs excl btw" als cost', () => {
    const mapping = detectColumnMapping(['SKU', 'Naam', 'Maat', 'Inkoopprijs excl btw'])
    expect(mapping.variant).toBe(2)
    expect(mapping.cost).toBe(3)
  })

  it('herkent de kolommen uit het echte importsjabloon', () => {
    const mapping = detectColumnMapping([
      'SKU',
      'Naam',
      'Categorie',
      'Variant',
      'Prijs',
      'Inkoopprijs',
      'Voorraad',
      'Minimum voorraad',
      'Barcode',
    ])
    expect(mapping).toEqual({
      sku: 0,
      name: 1,
      category: 2,
      variant: 3,
      price: 4,
      cost: 5,
      stock: 6,
      minStock: 7,
      barcode: 8,
    })
  })

  it('laat een veld weg als geen enkele kolom matcht', () => {
    const mapping = detectColumnMapping(['SKU', 'Naam'])
    expect(mapping.barcode).toBeUndefined()
  })
})

describe('parseImportRows', () => {
  const mapping = detectColumnMapping(['SKU', 'Naam', 'Categorie', 'Variant', 'Prijs', 'Inkoopprijs', 'Voorraad'])

  it('markeert een rij zonder naam én zonder sku als fout', () => {
    const { parsed, errors } = parseImportRows([['', '', 'T-shirts', '', '35', '9,50', '10']], mapping, new Map())
    expect(parsed).toHaveLength(0)
    expect(errors[0].reason).toBe('Geen naam en geen SKU')
  })

  it('genereert een SKU voor een rij zonder SKU', () => {
    const { parsed } = parseImportRows([['', 'Logo Cap', 'Accessoires', '', '28', '6', '60']], mapping, new Map())
    expect(parsed[0].sku).toMatch(/^LOGOCAP-/)
  })

  it('leest "1.234,50" en "12,50" correct als centen', () => {
    const { parsed } = parseImportRows(
      [['SKU1', 'Duur Ding', 'Overig', '', '1.234,50', '12,50', '1']],
      mapping,
      new Map(),
    )
    expect(parsed[0].priceCents).toBe(cents(123450))
    expect(parsed[0].costCents).toBe(cents(1250))
  })

  it('markeert een ongeldige prijs als fout', () => {
    const { errors } = parseImportRows([['SKU1', 'Iets', 'Overig', '', 'abc', '1', '1']], mapping, new Map())
    expect(errors[0].reason).toContain('Ongeldige prijs')
  })

  it('markeert dubbele SKUs binnen hetzelfde bestand als fout', () => {
    const { parsed, errors } = parseImportRows(
      [
        ['SKU1', 'Shirt', 'T-shirts', 'M', '35', '9,50', '10'],
        ['SKU1', 'Shirt', 'T-shirts', 'L', '35', '9,50', '5'],
      ],
      mapping,
      new Map(),
    )
    expect(parsed).toHaveLength(1)
    expect(errors[0].reason).toContain('dubbel')
  })

  it('koppelt een rij aan een bestaand product op SKU, niet hoofdlettergevoelig', () => {
    const existing: ExistingProduct = { id: 'prod-1', sku: 'sku1', stock: 20 }
    const existingBySku = new Map([['sku1', existing]])
    const { parsed } = parseImportRows([['SKU1', 'Shirt', 'T-shirts', 'M', '35', '9,50', '30']], mapping, existingBySku)
    expect(parsed[0].existing).toEqual(existing)
  })
})

describe('buildImportPlan', () => {
  const mapping = detectColumnMapping(['SKU', 'Naam', 'Categorie', 'Variant', 'Prijs', 'Inkoopprijs', 'Voorraad'])

  it('telt bij "add"-modus de geïmporteerde voorraad op bij de bestaande stand via een movement', () => {
    const existing: ExistingProduct = { id: 'prod-1', sku: 'sku1', stock: 20 }
    const { parsed } = parseImportRows(
      [['SKU1', 'Shirt', 'T-shirts', 'M', '35', '9,50', '10']],
      mapping,
      new Map([['sku1', existing]]),
    )
    const plan = buildImportPlan(parsed, 'add')
    expect(plan.updatedProducts).toHaveLength(1)
    expect(plan.movements).toEqual([{ productId: 'prod-1', sku: 'SKU1', delta: 10, reason: 'import' }])
  })

  it('berekent bij "overwrite"-modus het verschil met de huidige voorraad', () => {
    const existing: ExistingProduct = { id: 'prod-1', sku: 'sku1', stock: 20 }
    const { parsed } = parseImportRows(
      [['SKU1', 'Shirt', 'T-shirts', 'M', '35', '9,50', '30']],
      mapping,
      new Map([['sku1', existing]]),
    )
    const plan = buildImportPlan(parsed, 'overwrite')
    expect(plan.movements).toEqual([{ productId: 'prod-1', sku: 'SKU1', delta: 10, reason: 'import' }])
  })

  it('genereert geen movement als de voorraad niet verandert', () => {
    const existing: ExistingProduct = { id: 'prod-1', sku: 'sku1', stock: 20 }
    const { parsed } = parseImportRows(
      [['SKU1', 'Shirt', 'T-shirts', 'M', '35', '9,50', '20']],
      mapping,
      new Map([['sku1', existing]]),
    )
    const plan = buildImportPlan(parsed, 'overwrite')
    expect(plan.movements).toHaveLength(0)
  })

  it('plaatst een nieuw product met voorraad > 0 in newProducts mét een movement zonder productId', () => {
    const { parsed } = parseImportRows([['SKU9', 'Nieuw Shirt', 'T-shirts', 'M', '35', '9,50', '15']], mapping, new Map())
    const plan = buildImportPlan(parsed, 'add')
    expect(plan.newProducts).toHaveLength(1)
    expect(plan.movements).toEqual([{ productId: null, sku: 'SKU9', delta: 15, reason: 'import' }])
  })
})
