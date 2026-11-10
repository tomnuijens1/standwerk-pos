import { useState } from 'react'
import * as XLSX from 'xlsx'
import { REASON_LABELS, type StockMovementReason, useStockMovements } from '../api/stockMovements'

interface Props {
  eventId: string
}

export function StockMovementsLog({ eventId }: Props) {
  const { data: movements = [], isLoading } = useStockMovements(eventId)
  const [query, setQuery] = useState('')
  const [reasonFilter, setReasonFilter] = useState<StockMovementReason | 'all'>('all')

  const visible = movements
    .filter((m) => reasonFilter === 'all' || m.reason === reasonFilter)
    .filter((m) => (query ? `${m.name} ${m.sku}`.toLowerCase().includes(query.toLowerCase()) : true))

  function handleExport() {
    const sheet = XLSX.utils.json_to_sheet(
      visible.map((m) => ({
        Datum: new Date(m.createdAt).toLocaleString('nl-NL'),
        SKU: m.sku,
        Naam: m.name,
        Variant: m.variant,
        Mutatie: m.delta,
        'Voorraad na mutatie': m.balanceAfter ?? '',
        Reden: REASON_LABELS[m.reason],
        Referentie: m.ref ?? '',
        Kassa: m.registerName ?? '',
      })),
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Voorraadmutaties')
    XLSX.writeFile(workbook, 'voorraadmutaties.xlsx')
  }

  if (isLoading) return <div className="auth-gate-loading">Mutaties laden…</div>

  return (
    <div>
      <div className="inv-head">
        <div className="inv-actions">
          <input placeholder="Zoeken…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value as StockMovementReason | 'all')}>
            <option value="all">Alle redenen</option>
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button onClick={handleExport}>Excel exporteren</button>
      </div>

      <table className="inv-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Product</th>
            <th>Mutatie</th>
            <th>Voorraad na</th>
            <th>Reden</th>
            <th>Referentie</th>
            <th>Kassa</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={7} className="tx-empty">
                Geen mutaties gevonden.
              </td>
            </tr>
          )}
          {visible.map((m) => (
            <tr key={m.id}>
              <td>{new Date(m.createdAt).toLocaleString('nl-NL')}</td>
              <td>
                {m.name}
                {m.variant ? ` · ${m.variant}` : ''}
              </td>
              <td className={m.delta < 0 ? 'rank-bad' : 'rank-ok'}>
                {m.delta > 0 ? '+' : ''}
                {m.delta}
              </td>
              <td>{m.balanceAfter ?? '—'}</td>
              <td>{REASON_LABELS[m.reason]}</td>
              <td>{m.ref ?? '—'}</td>
              <td>{m.registerName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
