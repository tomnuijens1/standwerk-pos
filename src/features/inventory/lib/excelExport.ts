import * as XLSX from 'xlsx'
import { formatEuro, multiplyCents } from '../../../shared/money/money'
import type { Product } from '../../../shared/lib/product'

/** Zelfde kolomopzet als het voorraad-tabblad in het prototype. */
export function exportInventoryToExcel(products: Product[], filename = 'voorraad.xlsx') {
  const rows = products.map((p) => ({
    SKU: p.sku,
    Naam: p.name,
    Categorie: p.category,
    Variant: p.variant,
    Prijs: p.priceCents / 100,
    Inkoopprijs: p.costCents / 100,
    Voorraad: p.stock,
    'Minimum voorraad': p.minStock ?? '',
    Barcode: p.barcode ?? '',
    Status: p.stock === 0 ? 'Uitverkocht' : p.minStock !== null && p.stock <= p.minStock ? 'Bijna op' : 'Op voorraad',
    Verkoopwaarde: formatEuro(multiplyCents(p.priceCents, p.stock)),
    Inkoopwaarde: formatEuro(multiplyCents(p.costCents, p.stock)),
  }))

  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Voorraad')
  XLSX.writeFile(workbook, filename)
}
