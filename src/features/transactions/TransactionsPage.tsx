import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatEuro } from '../../shared/money/money'
import { type Receipt, useReceipts } from './api/receipts'
import './transactions.css'

const METHOD_LABELS: Record<Receipt['method'], string> = { pin: 'Pin', cash: 'Contant', qr: 'QR' }

export function TransactionsPage() {
  const { data: receipts = [], isLoading } = useReceipts()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('zoek') ?? '')
  const [selected, setSelected] = useState<Receipt | null>(null)

  // Vanuit de kassa kan Enter op een bonnummer hierheen navigeren met ?zoek=...
  useEffect(() => {
    const fromSearch = searchParams.get('zoek')
    if (fromSearch) setQuery(fromSearch)
  }, [searchParams])

  const visible = receipts.filter((r) => {
    if (!query) return true
    const receiptLabel = `${r.registerCode}-${r.receiptNumber}`.toLowerCase()
    return receiptLabel.includes(query.toLowerCase()) || r.lines.some((l) => l.name.toLowerCase().includes(query.toLowerCase()))
  })

  if (isLoading) return <div className="auth-gate-loading">Bonnen laden…</div>

  return (
    <div>
      <h1>Transacties</h1>
      <input className="tx-search" placeholder="Zoek op bonnummer of product…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {visible.length === 0 && <p className="tx-empty">Nog geen bonnen. Reken een verkoop af op de Kassa om er hier een te zien.</p>}

      <table className="inv-table">
        <thead>
          <tr>
            <th>Bon</th>
            <th>Datum</th>
            <th>Methode</th>
            <th>Items</th>
            <th>Totaal</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.id} className="tx-row" onClick={() => setSelected(r)}>
              <td>
                {r.registerCode}-{r.receiptNumber}
              </td>
              <td>{new Date(r.ts).toLocaleString('nl-NL')}</td>
              <td>{METHOD_LABELS[r.method]}</td>
              <td>{r.lines.reduce((n, l) => n + l.qty, 0)}</td>
              <td>{formatEuro(r.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              Bon {selected.registerCode}-{selected.receiptNumber}
            </h2>
            <p className="amount-due">
              {selected.register} · {new Date(selected.ts).toLocaleString('nl-NL')}
            </p>
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Aantal</th>
                  <th>Prijs</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((l) => (
                  <tr key={l.productId}>
                    <td>
                      {l.name}
                      {l.variant ? ` · ${l.variant}` : ''}
                    </td>
                    <td>{l.qty}</td>
                    <td>{formatEuro(l.unitPriceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sum">
              <div className="sum-row">
                <span>Subtotaal</span>
                <span className="amount">{formatEuro(selected.subtotalCents)}</span>
              </div>
              <div className="sum-row">
                <span>Korting</span>
                <span className="amount">− {formatEuro(selected.discountCents)}</span>
              </div>
              <div className="sum-row total">
                <span>Totaal</span>
                <span className="amount">{formatEuro(selected.totalCents)}</span>
              </div>
              {selected.receivedCents !== null && (
                <>
                  <div className="sum-row">
                    <span>Ontvangen</span>
                    <span className="amount">{formatEuro(selected.receivedCents)}</span>
                  </div>
                  <div className="sum-row">
                    <span>Wisselgeld</span>
                    <span className="amount">{formatEuro(selected.changeCents!)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="modal-foot">
              <button onClick={() => setSelected(null)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
