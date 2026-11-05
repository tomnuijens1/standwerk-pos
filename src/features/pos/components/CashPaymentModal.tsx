import { useMemo, useState } from 'react'
import { calculateChange, type Cents, cents, formatEuro, parseEuroInputToCents } from '../../../shared/money/money'

interface Props {
  amountDue: Cents
  onClose: () => void
  onConfirm: (received: Cents) => void
}

function roundUpTo(amount: Cents, step: number): Cents {
  const stepCents = step * 100
  return cents(Math.ceil(amount / stepCents) * stepCents)
}

export function CashPaymentModal({ amountDue, onClose, onConfirm }: Props) {
  const [input, setInput] = useState(() => (amountDue / 100).toFixed(2).replace('.', ','))

  const suggestions = useMemo(
    () => [amountDue, roundUpTo(amountDue, 10), roundUpTo(amountDue, 20), roundUpTo(amountDue, 50)],
    [amountDue],
  )

  let received: Cents | null = null
  let error: string | null = null
  try {
    received = parseEuroInputToCents(input)
  } catch {
    error = 'Ongeldig bedrag'
  }

  const change = received !== null && received >= amountDue ? calculateChange(amountDue, received) : null
  if (received !== null && received < amountDue) {
    error = 'Ontvangen bedrag is lager dan het verschuldigde bedrag'
  }

  function confirm() {
    if (received === null || received < amountDue) return
    onConfirm(received)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal cash-modal">
        <h2>Contant afrekenen</h2>
        <p className="amount-due">Te betalen: {formatEuro(amountDue)}</p>

        <div className="quick-amounts">
          {[...new Set(suggestions)].map((amount) => (
            <button key={amount} onClick={() => setInput((amount / 100).toFixed(2).replace('.', ','))}>
              {formatEuro(amount)}
            </button>
          ))}
        </div>

        <label>
          Ontvangen bedrag
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
            }}
          />
        </label>

        {error && <p className="error-text">{error}</p>}
        {change !== null && <p className="change-amount">Wisselgeld: {formatEuro(change)}</p>}

        <div className="modal-foot">
          <button onClick={onClose}>Annuleren</button>
          <button className="accent" disabled={received === null || received < amountDue} onClick={confirm}>
            Afrekenen
          </button>
        </div>
      </div>
    </div>
  )
}
