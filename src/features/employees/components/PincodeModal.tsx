import { useState } from 'react'
import { useCurrentEvent } from '../../../app/EventGate'
import { type Employee, verifyPincode } from '../api/employees'

interface Props {
  title?: string
  requireRole?: 'manager'
  onSuccess: (employee: Pick<Employee, 'id' | 'name' | 'role'>) => void
  onClose: () => void
}

/** Herbruikbaar pincode-scherm: zowel voor "inloggen als medewerker" (geen
 * requireRole) als voor een eenmalige manager-goedkeuring (requireRole='manager'),
 * bijvoorbeeld bij een retour of korting boven de limiet. */
export function PincodeModal({ title = 'Pincode', requireRole, onSuccess, onClose }: Props) {
  const event = useCurrentEvent()
  const [digits, setDigits] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function submit(value: string) {
    if (value.length < 4 || checking) return
    setChecking(true)
    setError(null)
    try {
      const employee = await verifyPincode(event.id, value)
      if (!employee) {
        setError('Onjuiste pincode')
        setDigits('')
        return
      }
      if (requireRole && employee.role !== requireRole) {
        setError('Deze pincode hoort niet bij een manager')
        setDigits('')
        return
      }
      onSuccess(employee)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setChecking(false)
    }
  }

  function press(digit: string) {
    if (digits.length >= 6) return
    const next = digits + digit
    setDigits(next)
    setError(null)
    if (next.length >= 4) void submit(next)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal pincode-modal">
        <h2>{title}</h2>
        {requireRole === 'manager' && <p className="amount-due">Vraag een manager om hun pincode in te voeren.</p>}
        <div className="pincode-dots">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={`pincode-dot ${i < digits.length ? 'filled' : ''}`} />
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="pincode-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) =>
            key === '' ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                disabled={checking}
                onClick={() => (key === '⌫' ? setDigits((d) => d.slice(0, -1)) : press(key))}
              >
                {key}
              </button>
            ),
          )}
        </div>
        <div className="modal-foot">
          <button onClick={onClose}>Annuleren</button>
        </div>
      </div>
    </div>
  )
}
