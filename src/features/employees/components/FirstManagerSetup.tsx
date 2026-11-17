import { useState } from 'react'
import { useCurrentEvent } from '../../../app/EventGate'
import { useCreateEmployee } from '../api/employees'
import { useActiveEmployee } from '../useActiveEmployee'

/**
 * Eenmalig scherm voor een gloednieuw event: er is nog geen enkele medewerker,
 * dus niemand kan inloggen, dus niemand komt bij Instellingen om de eerste
 * manager aan te maken. De database staat deze ene eerste manager toe zonder
 * bestaande manager-pincode (zie create_employee in migratie 00007); daarna is
 * een manager-pincode verplicht.
 */
export function FirstManagerSetup() {
  const event = useCurrentEvent()
  const createEmployee = useCreateEmployee(event.id)
  const { setEmployee } = useActiveEmployee()

  const [name, setName] = useState('')
  const [pincode, setPincode] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Eerste manager instellen</h2>
        <p className="amount-due">
          Dit event heeft nog geen medewerkers. Maak een manager aan om te beginnen — met deze pincode kun je later de
          rest van het team toevoegen.
        </p>

        <label>
          Naam
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Pincode (4-6 cijfers)
          <input
            inputMode="numeric"
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
            placeholder="bijv. 1234"
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-foot">
          <button
            className="accent"
            disabled={!name || pincode.length < 4 || createEmployee.isPending}
            onClick={() => {
              setError(null)
              createEmployee.mutate(
                { name, pincode, role: 'manager', actingEmployeeId: null },
                {
                  onSuccess: (created) => setEmployee({ id: created.id, name: created.name, role: created.role }),
                  onError: (e: Error) => setError(e.message),
                },
              )
            }}
          >
            Manager aanmaken
          </button>
        </div>
      </div>
    </div>
  )
}
