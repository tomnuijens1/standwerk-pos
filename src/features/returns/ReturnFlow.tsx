import { useMemo, useState } from 'react'
import { useCurrentEvent } from '../../app/EventGate'
import { addCents, cents, formatEuro, multiplyCents, proRataRefundUnit } from '../../shared/money/money'
import type { Product } from '../../shared/lib/product'
import type { Credit } from '../pos/hooks/useCart'
import { fetchSaleForReturn, useCreateRefund, type SaleForReturn } from './api/returns'
import './returns.css'

const REASONS = [
  { value: 'wrong_size', label: 'Verkeerde maat', defaultRestock: true },
  { value: 'defective', label: 'Defect of beschadigd', defaultRestock: false },
  { value: 'unhappy', label: 'Klant ontevreden', defaultRestock: true },
  { value: 'mis_scanned', label: 'Verkeerd aangeslagen', defaultRestock: true },
  { value: 'other', label: 'Anders', defaultRestock: true },
] as const

const METHOD_LABELS = { pin: 'Pin', cash: 'Contant', qr: 'QR', exchange: 'Omruilen' } as const

interface SelectedLine {
  productId: string
  sku: string
  name: string
  variant: string
  qty: number
  max: number | null // null = geen bon, geen limiet
  originalUnitPriceCents: number
  refundedUnitCents: number
}

interface Props {
  registerId: string
  products: Product[]
  onClose: () => void
  onCreditIssued: (credit: Credit) => void
}

export function ReturnFlow({ registerId, products, onClose, onCreditIssued }: Props) {
  const event = useCurrentEvent()
  const createRefund = useCreateRefund(event.id)

  const [receiptInput, setReceiptInput] = useState('')
  const [sale, setSale] = useState<SaleForReturn | null>(null)
  const [withoutReceipt, setWithoutReceipt] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, SelectedLine>>({})
  const [reason, setReason] = useState<(typeof REASONS)[number]['value']>('wrong_size')
  const [restock, setRestock] = useState(true)
  const [method, setMethod] = useState<'pin' | 'cash' | 'qr' | 'exchange'>('cash')
  const [query, setQuery] = useState('')
  const [isLate, setIsLate] = useState(false)

  async function lookupReceipt() {
    const match = receiptInput.trim().match(/^([a-z]{1,4})-(\d+)$/i)
    if (!match) {
      setSearchError('Formaat is bijv. "HOO-3"')
      return
    }
    setSearchError(null)
    const result = await fetchSaleForReturn(event.id, match[1], Number(match[2]))
    if (!result) {
      setSearchError('Geen bon gevonden met dat nummer')
      return
    }
    setSale(result)
    setMethod(result.method)
    // Bewust hier (in de event handler) berekend, niet tijdens render: de
    // retourtermijn-check hoeft maar één keer, op het moment van opzoeken.
    const ageMs = Date.now() - new Date(result.createdAt).getTime()
    setIsLate(ageMs > event.return_days * 24 * 60 * 60 * 1000)
  }

  function toggleLineFromSale(item: SaleForReturn['items'][number]) {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[item.productId]) {
        delete next[item.productId]
      } else if (sale) {
        const refundedUnit = proRataRefundUnit(item.unitPriceCents, sale.totalCents, sale.subtotalCents)
        next[item.productId] = {
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          variant: item.variant,
          qty: Math.min(1, item.maxReturnableQty),
          max: item.maxReturnableQty,
          originalUnitPriceCents: item.unitPriceCents,
          refundedUnitCents: refundedUnit,
        }
      }
      return next
    })
  }

  function toggleLineFromProduct(p: Product) {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[p.id]) {
        delete next[p.id]
      } else {
        next[p.id] = {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          variant: p.variant,
          qty: 1,
          max: null,
          originalUnitPriceCents: p.priceCents,
          refundedUnitCents: p.priceCents,
        }
      }
      return next
    })
  }

  function changeQty(productId: string, delta: number) {
    setSelected((prev) => {
      const line = prev[productId]
      if (!line) return prev
      const max = line.max ?? Infinity
      const qty = Math.min(max, Math.max(1, line.qty + delta))
      return { ...prev, [productId]: { ...line, qty } }
    })
  }

  const lines = Object.values(selected)
  const totalRefundCents = useMemo(
    () => (lines.length === 0 ? cents(0) : addCents(...lines.map((l) => multiplyCents(cents(l.refundedUnitCents), l.qty)))),
    [lines],
  )


  const visibleProducts = products.filter((p) => (query ? `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()) : true))

  function confirm() {
    if (lines.length === 0) return
    const defaultRestock = REASONS.find((r) => r.value === reason)?.defaultRestock ?? true

    createRefund.mutate(
      {
        registerId,
        method,
        reason,
        restock: restock ?? defaultRestock,
        refSaleId: sale?.saleId ?? null,
        items: lines.map((l) => ({
          product_id: l.productId,
          qty: l.qty,
          original_unit_price_cents: l.originalUnitPriceCents,
          refunded_unit_cents: l.refundedUnitCents,
        })),
      },
      {
        onSuccess: ({ refund_id, receipt_number }) => {
          if (method === 'exchange') {
            onCreditIssued({ refundId: refund_id, amountCents: totalRefundCents, label: `Omruiltegoed RET-${receipt_number}` })
          }
          window.alert(`Retour RET-${receipt_number} geboekt: ${formatEuro(totalRefundCents)}`)
          onClose()
        },
        onError: (e: Error) => window.alert(`Retour mislukt: ${e.message}`),
      },
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal return-modal">
        <h2>Retour of omruilen</h2>

        {!sale && !withoutReceipt && (
          <>
            <label>
              Bonnummer
              <input
                autoFocus
                placeholder="bijv. HOO-3"
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void lookupReceipt()
                }}
              />
            </label>
            {searchError && <p className="error-text">{searchError}</p>}
            <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
              <button onClick={onClose}>Annuleren</button>
              <button onClick={() => setWithoutReceipt(true)}>Retour zonder bon</button>
              <button className="accent" onClick={() => void lookupReceipt()}>
                Zoeken
              </button>
            </div>
          </>
        )}

        {sale && (
          <>
            <p className="amount-due">
              Bon {sale.registerCode}-{sale.receiptNumber} · {new Date(sale.createdAt).toLocaleString('nl-NL')}
            </p>
            {isLate && <p className="error-text">Deze bon valt buiten de retourtermijn van {event.return_days} dagen — retour kan nog wel.</p>}
            <div className="return-lines">
              {sale.items.map((item) => (
                <label key={item.productId} className="return-line">
                  <input
                    type="checkbox"
                    disabled={item.maxReturnableQty === 0}
                    checked={Boolean(selected[item.productId])}
                    onChange={() => toggleLineFromSale(item)}
                  />
                  <span className="return-line-name">
                    {item.name}
                    {item.variant ? ` · ${item.variant}` : ''}
                    {item.maxReturnableQty === 0 && ' (al volledig geretourneerd)'}
                  </span>
                  {selected[item.productId] && (
                    <span className="qty-ctrl">
                      <button type="button" onClick={() => changeQty(item.productId, -1)}>
                        −
                      </button>
                      <span>{selected[item.productId].qty}</span>
                      <button type="button" onClick={() => changeQty(item.productId, 1)}>
                        +
                      </button>
                    </span>
                  )}
                </label>
              ))}
            </div>
          </>
        )}

        {withoutReceipt && !sale && (
          <>
            <input className="tx-search" placeholder="Product zoeken…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="return-lines">
              {visibleProducts.slice(0, 20).map((p) => (
                <label key={p.id} className="return-line">
                  <input type="checkbox" checked={Boolean(selected[p.id])} onChange={() => toggleLineFromProduct(p)} />
                  <span className="return-line-name">
                    {p.name}
                    {p.variant ? ` · ${p.variant}` : ''} — {formatEuro(p.priceCents)}
                  </span>
                  {selected[p.id] && (
                    <span className="qty-ctrl">
                      <button type="button" onClick={() => changeQty(p.id, -1)}>
                        −
                      </button>
                      <span>{selected[p.id].qty}</span>
                      <button type="button" onClick={() => changeQty(p.id, 1)}>
                        +
                      </button>
                    </span>
                  )}
                </label>
              ))}
            </div>
          </>
        )}

        {(sale || withoutReceipt) && (
          <>
            <label>
              Reden
              <select
                value={reason}
                onChange={(e) => {
                  const value = e.target.value as (typeof REASONS)[number]['value']
                  setReason(value)
                  setRestock(REASONS.find((r) => r.value === value)?.defaultRestock ?? true)
                }}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="return-checkbox">
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
              Terug in voorraad boeken
            </label>

            <label>
              Terugbetaalmethode
              <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="sum">
              <div className="sum-row total">
                <span>Terug te betalen</span>
                <span className="amount">{formatEuro(totalRefundCents)}</span>
              </div>
            </div>

            <div className="modal-foot">
              <button onClick={onClose}>Annuleren</button>
              <button className="accent" disabled={lines.length === 0 || createRefund.isPending} onClick={confirm}>
                Retour boeken
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
