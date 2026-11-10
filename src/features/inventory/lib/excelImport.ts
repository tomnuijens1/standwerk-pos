import { type Cents, cents, parseEuroInputToCents } from '../../../shared/money/money'

export type ImportField = 'sku' | 'name' | 'category' | 'variant' | 'price' | 'cost' | 'stock' | 'minStock' | 'barcode'

/** Zelfde kolom-aliassen als het prototype (standwerk-pos.html, de ALIASES-tabel). */
export const COLUMN_ALIASES: Record<ImportField, string[]> = {
  sku: ['sku', 'artikelnummer', 'artikelnr', 'artnr', 'code', 'productcode'],
  name: ['naam', 'product', 'productnaam', 'name', 'omschrijving', 'artikel', 'titel'],
  category: ['categorie', 'category', 'groep', 'productgroep', 'type'],
  variant: ['variant', 'maat', 'size', 'kleur', 'optie'],
  price: ['prijs', 'verkoopprijs', 'price', 'prijsinclbtw', 'verkoopprijsinclbtw'],
  cost: ['inkoopprijs', 'inkoop', 'cost', 'kostprijs', 'inkoopprijsexclbtw'],
  stock: ['voorraad', 'stock', 'aantal', 'qty', 'quantity', 'opvoorraad'],
  minStock: ['minimumvoorraad', 'minvoorraad', 'minimum', 'min', 'minstock', 'bestelpunt'],
  barcode: ['barcode', 'ean', 'gtin', 'upc', 'ean13'],
}

const IMPORT_FIELDS = Object.keys(COLUMN_ALIASES) as ImportField[]

/** lowercase + verwijder leestekens, zoals normH() in het prototype. */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[._\-/()€\s]/g, '')
}

export type ColumnMapping = Partial<Record<ImportField, number>>

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader)
  const mapping: ColumnMapping = {}

  for (const field of IMPORT_FIELDS) {
    const aliasSet = new Set(COLUMN_ALIASES[field].map(normalizeHeader))
    const index = normalized.findIndex((h) => aliasSet.has(h))
    if (index !== -1) {
      mapping[field] = index
    }
  }

  return mapping
}

export interface ExistingProduct {
  id: string
  sku: string
  stock: number
}

export interface ParsedRow {
  rowNumber: number // 1-based, exclusief header
  sku: string
  name: string
  category: string
  variant: string
  priceCents: Cents
  costCents: Cents
  stock: number
  minStock: number | null
  barcode: string | null
  existing: ExistingProduct | null
}

export interface ImportRowError {
  rowNumber: number
  reason: string
}

function generateSku(name: string, rowNumber: number): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8)
  return `${slug || 'ART'}-${rowNumber}`
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function parseIntOrNull(value: unknown): number | null {
  const str = cellToString(value)
  if (str === '') return null
  const n = Number.parseInt(str, 10)
  return Number.isFinite(n) ? n : null
}

export function parseImportRows(
  rawRows: unknown[][],
  mapping: ColumnMapping,
  existingBySku: Map<string, ExistingProduct>,
): { parsed: ParsedRow[]; errors: ImportRowError[] } {
  const parsed: ParsedRow[] = []
  const errors: ImportRowError[] = []
  const seenSkusInFile = new Set<string>()

  rawRows.forEach((row, index) => {
    const rowNumber = index + 1
    const get = (field: ImportField) => (mapping[field] !== undefined ? cellToString(row[mapping[field]!]) : '')

    const name = get('name')
    let sku = get('sku')

    if (!name && !sku) {
      errors.push({ rowNumber, reason: 'Geen naam en geen SKU' })
      return
    }

    if (!sku) {
      sku = generateSku(name, rowNumber)
    }

    const skuKey = sku.toLowerCase()
    if (seenSkusInFile.has(skuKey)) {
      errors.push({ rowNumber, reason: `SKU "${sku}" komt dubbel voor in dit bestand` })
      return
    }
    seenSkusInFile.add(skuKey)

    let priceCents: Cents
    try {
      priceCents = get('price') ? parseEuroInputToCents(get('price')) : cents(0)
    } catch {
      errors.push({ rowNumber, reason: `Ongeldige prijs: "${get('price')}"` })
      return
    }

    let costCents: Cents
    try {
      costCents = get('cost') ? parseEuroInputToCents(get('cost')) : cents(0)
    } catch {
      errors.push({ rowNumber, reason: `Ongeldige inkoopprijs: "${get('cost')}"` })
      return
    }

    const stock = parseIntOrNull(get('stock')) ?? 0
    const minStock = parseIntOrNull(get('minStock'))
    const barcode = get('barcode') || null

    parsed.push({
      rowNumber,
      sku,
      name: name || sku,
      category: get('category') || 'Overig',
      variant: get('variant'),
      priceCents,
      costCents,
      stock,
      minStock,
      barcode,
      existing: existingBySku.get(skuKey) ?? null,
    })
  })

  return { parsed, errors }
}

export type ImportMode = 'overwrite' | 'add'

export interface ProductUpsert {
  sku: string
  name: string
  category: string
  variant: string
  priceCents: Cents
  costCents: Cents
  minStock: number | null
  barcode: string | null
}

export interface StockMovementDraft {
  productId: string | null // null voor een nieuw product, pas bekend na create_product
  sku: string
  delta: number
  reason: 'import'
}

export interface ImportPlan {
  newProducts: ProductUpsert[]
  updatedProducts: (ProductUpsert & { id: string })[]
  movements: StockMovementDraft[]
}

export function buildImportPlan(parsed: ParsedRow[], mode: ImportMode): ImportPlan {
  const newProducts: ProductUpsert[] = []
  const updatedProducts: (ProductUpsert & { id: string })[] = []
  const movements: StockMovementDraft[] = []

  for (const row of parsed) {
    const base: ProductUpsert = {
      sku: row.sku,
      name: row.name,
      category: row.category,
      variant: row.variant,
      priceCents: row.priceCents,
      costCents: row.costCents,
      minStock: row.minStock,
      barcode: row.barcode,
    }

    if (row.existing) {
      updatedProducts.push({ ...base, id: row.existing.id })
      const delta = mode === 'add' ? row.stock : row.stock - row.existing.stock
      if (delta !== 0) {
        movements.push({ productId: row.existing.id, sku: row.sku, delta, reason: 'import' })
      }
    } else {
      newProducts.push(base)
      if (row.stock !== 0) {
        movements.push({ productId: null, sku: row.sku, delta: row.stock, reason: 'import' })
      }
    }
  }

  return { newProducts, updatedProducts, movements }
}
