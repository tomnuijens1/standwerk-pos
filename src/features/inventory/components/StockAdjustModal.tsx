import { useState } from 'react'
import type { Product } from '../../../shared/lib/product'
import { useAdjustStock } from '../api/stockMovements'

type AdjustType = 'delivery' | 'count'

interface Props {
  eventId: string
  product: Product
  onClose: () => void
}

export function StockAdjustModal({ eventId, product, onClose }: Props) {
  const [type, setType] = useState<AdjustType>('delivery')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const adjust = useAdjustStock(eventId)

  const parsed = Number.parseInt(value, 10)
  const delta = type === 'delivery' ? parsed : Number.isFinite(parsed) ? parsed - product.stock : NaN
  const valid = Number.isFinite(delta) && delta !== 0

  function confirm() {
    if (!valid) return
    adjust.mutate(
      { productId: product.id, delta, reason: type, ref: note || null },
      {
        onSuccess: onClose,
        onError: (e: Error) => window.alert(`Aanpassen mislukt: ${e.message}`),
      },
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Voorraad aanpassen</h2>
        <p className="amount-due">
          {product.name}
          {product.variant ? ` · ${product.variant}` : ''} — nu {product.stock} op voorraad
        </p>

        <div className="seg">
          <button aria-pressed={type === 'delivery'} onClick={() => setType('delivery')}>
            Levering bijboeken
          </button>
          <button aria-pressed={type === 'count'} onClick={() => setType('count')}>
            Telling invoeren
          </button>
        </div>

        <label>
          {type === 'delivery' ? 'Aantal ontvangen' : 'Geteld aantal (nieuwe totale voorraad)'}
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </label>

        {value !== '' && Number.isFinite(delta) && (
          <p className={delta < 0 ? 'error-text' : 'amount-due'}>
            Mutatie: {delta > 0 ? '+' : ''}
            {delta} · nieuwe voorraad: {product.stock + delta}
          </p>
        )}

        <label>
          Notitie (optioneel)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="bijv. pakbonnummer" />
        </label>

        <div className="modal-foot">
          <button onClick={onClose}>Annuleren</button>
          <button className="accent" disabled={!valid || adjust.isPending} onClick={confirm}>
            Opslaan
          </button>
        </div>
      </div>
    </div>
  )
}
