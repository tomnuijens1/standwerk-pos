import { useState } from 'react'
import { useCurrentEvent } from '../../app/EventGate'
import { cents, formatEuro, parseEuroInputToCents } from '../../shared/money/money'
import { useCategories, useRegisters } from '../../shared/supabase/useEvent'
import { useCreateEmployee, useDeactivateEmployee, useEmployees } from '../employees/api/employees'
import { useCreateRegister, useUpdateCategoryVat, useUpdateEvent, useUpdateRegisterTerminal } from './api/settings'
import { useSettings } from './useSettings'
import './settings.css'

export function SettingsPage() {
  const event = useCurrentEvent()
  const { data: registers = [] } = useRegisters(event.id)
  const { data: categories = [] } = useCategories(event.id)
  const { data: employees = [] } = useEmployees(event.id)
  const { activeRegisterId, setActiveRegisterId } = useSettings()

  const updateEvent = useUpdateEvent()
  const createRegister = useCreateRegister(event.id)
  const updateCategoryVat = useUpdateCategoryVat(event.id)
  const updateRegisterTerminal = useUpdateRegisterTerminal(event.id)
  const createEmployee = useCreateEmployee(event.id)
  const deactivateEmployee = useDeactivateEmployee(event.id)

  const [newRegisterName, setNewRegisterName] = useState('')
  const [newRegisterCode, setNewRegisterCode] = useState('')

  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeePincode, setNewEmployeePincode] = useState('')
  const [newEmployeeRole, setNewEmployeeRole] = useState<'cashier' | 'manager'>('cashier')
  const [employeeError, setEmployeeError] = useState<string | null>(null)

  return (
    <div className="settings-page">
      <h1>Instellingen</h1>

      <label>
        Eventnaam
        <input defaultValue={event.name} onBlur={(e) => updateEvent.mutate({ id: event.id, name: e.target.value })} />
      </label>

      <label>
        Actieve kassa (voor dit apparaat)
        <select value={activeRegisterId ?? registers[0]?.id ?? ''} onChange={(e) => setActiveRegisterId(e.target.value)}>
          {registers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Betaalterminals</legend>
        <p className="amount-due">
          Vul per kassa het terminal-ID in (bij Adyen het POIID, bijv. &quot;S1F2-000158225400001&quot;). Laat leeg als deze kassa
          geen terminal heeft — dan bevestig je de pinbetaling handmatig.
        </p>
        {registers.map((r) => (
          <label key={r.id}>
            {r.name} ({r.code})
            <input
              defaultValue={r.terminal_id ?? ''}
              placeholder="bijv. S1F2-000158225400001"
              onBlur={(e) =>
                updateRegisterTerminal.mutate({ registerId: r.id, terminalId: e.target.value.trim() || null })
              }
            />
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Nieuwe kassa toevoegen</legend>
        <label>
          Naam
          <input value={newRegisterName} onChange={(e) => setNewRegisterName(e.target.value)} />
        </label>
        <label>
          Code (voor bonnummers, bijv. "HOO")
          <input value={newRegisterCode} onChange={(e) => setNewRegisterCode(e.target.value.toUpperCase())} />
        </label>
        <button
          disabled={!newRegisterName || !newRegisterCode}
          onClick={() => {
            createRegister.mutate(
              { name: newRegisterName, code: newRegisterCode },
              { onSuccess: () => { setNewRegisterName(''); setNewRegisterCode('') } },
            )
          }}
        >
          Kassa toevoegen
        </button>
      </fieldset>

      <fieldset>
        <legend>Btw per categorie</legend>
        {categories.map((c) => (
          <label key={c.id}>
            {c.name}
            <input
              type="number"
              defaultValue={c.default_vat_rate_bp / 100}
              onBlur={(e) => updateCategoryVat.mutate({ id: c.id, vatRateBp: Math.round(Number(e.target.value) * 100) })}
            />
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Medewerkers</legend>
        {employees.length === 0 && <p className="amount-due">Nog geen medewerkers toegevoegd.</p>}
        {employees.map((emp) => (
          <div key={emp.id} className="employee-row">
            <span>
              {emp.name} · {emp.role === 'manager' ? 'manager' : 'medewerker'}
              {!emp.active && ' (inactief)'}
            </span>
            {emp.active && (
              <button
                onClick={() => {
                  if (window.confirm(`${emp.name} deactiveren?`)) deactivateEmployee.mutate(emp.id)
                }}
              >
                Deactiveren
              </button>
            )}
          </div>
        ))}

        <label>
          Naam
          <input value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} />
        </label>
        <label>
          Pincode (4-6 cijfers)
          <input
            inputMode="numeric"
            value={newEmployeePincode}
            onChange={(e) => setNewEmployeePincode(e.target.value.replace(/\D/g, ''))}
            placeholder="bijv. 1234"
          />
        </label>
        <label>
          Rol
          <select value={newEmployeeRole} onChange={(e) => setNewEmployeeRole(e.target.value as 'cashier' | 'manager')}>
            <option value="cashier">Medewerker</option>
            <option value="manager">Manager</option>
          </select>
        </label>
        {employeeError && <p className="error-text">{employeeError}</p>}
        <button
          disabled={!newEmployeeName || newEmployeePincode.length < 4}
          onClick={() => {
            setEmployeeError(null)
            createEmployee.mutate(
              { name: newEmployeeName, pincode: newEmployeePincode, role: newEmployeeRole },
              {
                onSuccess: () => {
                  setNewEmployeeName('')
                  setNewEmployeePincode('')
                  setNewEmployeeRole('cashier')
                },
                onError: (e: Error) => setEmployeeError(e.message),
              },
            )
          }}
        >
          Medewerker toevoegen
        </button>
      </fieldset>

      <label>
        Korting-limiet zonder manager (%)
        <input
          type="number"
          defaultValue={event.max_discount_percent_without_manager}
          onBlur={(e) => updateEvent.mutate({ id: event.id, max_discount_percent_without_manager: Number(e.target.value) })}
        />
      </label>

      <label>
        Standaard minimumvoorraad
        <input
          type="number"
          defaultValue={event.low_stock_default}
          onBlur={(e) => updateEvent.mutate({ id: event.id, low_stock_default: Number(e.target.value) })}
        />
      </label>

      <label>
        Standaard wisselgeld bij opening
        <input
          defaultValue={formatEuro(cents(event.opening_float_cents))}
          onBlur={(e) => {
            try {
              updateEvent.mutate({ id: event.id, opening_float_cents: parseEuroInputToCents(e.target.value) })
            } catch {
              e.target.value = formatEuro(cents(event.opening_float_cents))
            }
          }}
        />
      </label>

      <label>
        Retourtermijn (dagen)
        <input
          type="number"
          defaultValue={event.return_days}
          onBlur={(e) => updateEvent.mutate({ id: event.id, return_days: Number(e.target.value) })}
        />
      </label>
    </div>
  )
}
