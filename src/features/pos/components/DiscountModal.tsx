import { useState } from 'react'
import { type Cents, parseEuroInputToCents } from '../../../shared/money/money'
import type { Discount } from '../hooks/useCart'

const QUICK_PERCENTAGES = [5, 10, 15, 20]

interface Props {
  current: Discount | null
  onApply: (discount: Discount) => void
  onRemove: () => void
  onClose: () => void
}

export function DiscountModal({ current, onApply, onRemove, onClose }: Props) {
  const [type, setType] = useState<'percentage' | 'amount'>(current?.type ?? 'percentage')
  const [amountInput, setAmountInput] = useState('')

  function applyAmount() {
    let amount: Cents
    try {
      amount = parseEuroInputToCents(amountInput)
    } catch {
      return
    }
    onApply({ type: 'amount', value: amount })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Korting</h2>
        <div className="seg">
          <button aria-pressed={type === 'percentage'} onClick={() => setType('percentage')}>
            Percentage
          </button>
          <button aria-pressed={type === 'amount'} onClick={() => setType('amount')}>
            Bedrag
          </button>
        </div>

        {type === 'percentage' ? (
          <div className="quick-amounts">
            {QUICK_PERCENTAGES.map((pct) => (
              <button key={pct} onClick={() => onApply({ type: 'percentage', value: pct })}>
                {pct}%
              </button>
            ))}
          </div>
        ) : (
          <label>
            Kortingsbedrag
            <input
              autoFocus
              placeholder="bijv. 5,00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyAmount()
              }}
            />
          </label>
        )}

        <div className="modal-foot">
          {current && (
            <button
              onClick={() => {
                onRemove()
                onClose()
              }}
            >
              Korting verwijderen
            </button>
          )}
          <button onClick={onClose}>Annuleren</button>
          {type === 'amount' && (
            <button className="accent" onClick={applyAmount}>
              Toepassen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
