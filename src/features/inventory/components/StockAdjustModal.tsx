import { useState } from 'react'
import type { Product } from '../../../shared/lib/product'
import { PincodeModal } from '../../employees/components/PincodeModal'
import { useActiveEmployee } from '../../employees/useActiveEmployee'
import { useAdjustStock } from '../api/stockMovements'

type AdjustType = 'delivery' | 'count' | 'correction'

interface Props {
  eventId: string
  product: Product
  onClose: () => void
}

const TYPE_LABELS: Record<AdjustType, string> = {
  delivery: 'Levering bijboeken',
  count: 'Telling invoeren',
  correction: 'Correctie',
}

export function StockAdjustModal({ eventId, product, onClose }: Props) {
  const [type, setType] = useState<AdjustType>('delivery')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [showManagerGate, setShowManagerGate] = useState(false)
  const adjust = useAdjustStock(eventId)
  const { employee: activeEmployee } = useActiveEmployee()

  // "Correctie" is voor losse aanpassingen zonder duidelijke levering/telling-
  // reden; die vragen daarom altijd om een manager-pincode, Levering/Telling
  // niet. Bij "Telling" vul je het nieuwe totaal in, bij de andere twee het
  // verschil zelf.
  const delta = type === 'count' ? (Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) - product.stock : NaN) : Number.parseInt(value, 10)
  const valid = Number.isFinite(delta) && delta !== 0

  function confirm() {
    if (!valid) return
    if (type === 'correction' && activeEmployee?.role !== 'manager') {
      setShowManagerGate(true)
      return
    }
    submit(activeEmployee?.id)
  }

  function submit(employeeId: string | undefined) {
    adjust.mutate(
      { productId: product.id, delta, reason: type, ref: note || null, employeeId },
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
          {(Object.keys(TYPE_LABELS) as AdjustType[]).map((t) => (
            <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <label>
          {type === 'count' ? 'Geteld aantal (nieuwe totale voorraad)' : 'Aantal (kan negatief zijn bij correctie)'}
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </label>

        {value !== '' && Number.isFinite(delta) && (
          <p className={delta < 0 ? 'error-text' : 'amount-due'}>
            Mutatie: {delta > 0 ? '+' : ''}
            {delta} · nieuwe voorraad: {product.stock + delta}
          </p>
        )}

        {type === 'correction' && (
          <p className="amount-due">Een correctie vraagt om goedkeuring van een manager.</p>
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

      {showManagerGate && (
        <PincodeModal
          title="Manager-goedkeuring voor correctie"
          requireRole="manager"
          onSuccess={(employee) => {
            setShowManagerGate(false)
            submit(employee.id)
          }}
          onClose={() => setShowManagerGate(false)}
        />
      )}
    </div>
  )
}
