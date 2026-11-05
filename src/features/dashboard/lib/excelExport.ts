import * as XLSX from 'xlsx'
import type { useDashboard } from '../useDashboard'
import type { DashboardRange } from './period'

/** 9 tabbladen, zoals doc 01: Samenvatting, Omzetverloop, Categorieën,
 * Producten, Kassa's, Betaalmethodes, Maten, Voorraadprognose, Retouren. */
export async function exportDashboardToExcel(d: ReturnType<typeof useDashboard>, range: DashboardRange, rangeLabel: string) {
  const workbook = XLSX.utils.book_new()

  const prevPct = (current: number, previous: number | undefined) => (previous ? (((current - previous) / Math.abs(previous)) * 100).toFixed(1) + '%' : '')

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Periode', rangeLabel],
      ['Netto omzet', d.stats.netCents / 100, 'Vorige periode', (d.previousStats?.netCents ?? 0) / 100, 'Verschil', prevPct(d.stats.netCents, d.previousStats?.netCents)],
      ['Transacties', d.stats.txCount],
      ['Gemiddelde bon', d.stats.avgSaleCents / 100],
      ['Items verkocht (netto)', d.stats.itemsCount],
      ['Retouren', d.stats.refundsCents / 100, 'Aantal', d.stats.refundsCount],
      ['Korting', d.stats.discountCents / 100, '% van bruto', d.stats.discountPercentOfGross.toFixed(1) + '%'],
      ['Btw', d.stats.vatCents / 100],
      ['Brutomarge', d.stats.marginCents !== null ? d.stats.marginCents / 100 : 'onbekend (geen inkoopprijzen)'],
    ]),
    'Samenvatting',
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(d.revenueSeries.map((b) => ({ Periode: b.label, Omzet: b.currentCents / 100, [`Omzet (${d.bounds.previousLabel || 'vorige'})`]: (b.previousCents ?? 0) / 100 }))),
    'Omzetverloop',
  )

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(d.byCategory.map((c) => ({ Categorie: c.category, 'Netto omzet': c.netCents / 100 }))), 'Categorieën')

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(d.bestsellers.map((b) => ({ Product: b.name, Categorie: b.category, Aantal: b.qty, 'Netto omzet': b.netCents / 100 }))),
    'Producten',
  )

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(d.byRegister.map((r) => ({ Kassa: r.register, 'Netto omzet': r.netCents / 100 }))), 'Kassa\'s')

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(d.byMethod.map((m) => ({ Betaalmethode: m.method, 'Netto omzet': m.netCents / 100 }))), 'Betaalmethodes')

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(d.bySize.map((s) => ({ Maat: s.variant, 'Netto stuks': s.qty }))), 'Maten')

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      d.stockForecast.map((f) => ({
        Product: f.name,
        Variant: f.variant,
        Voorraad: f.stock,
        'Gem. verkoop/dag': f.avgDailyQty.toFixed(2),
        'Dagen voorraad': Number.isFinite(f.daysLeft) ? f.daysLeft.toFixed(1) : '',
      })),
    ),
    'Voorraadprognose',
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      d.receipts
        .filter((r) => r.kind === 'refund')
        .map((r) => ({ Bon: `RET-${r.receiptNumber}`, Kassa: r.registerName, Datum: new Date(r.createdAt).toLocaleString('nl-NL'), Methode: r.method, Bedrag: r.totalCents / 100 })),
    ),
    'Retouren',
  )

  XLSX.writeFile(workbook, `dashboard-${range}.xlsx`)
}
