import { useState } from 'react'
import { useCurrentEvent } from '../../app/EventGate'
import { cents, formatEuro, parseEuroInputToCents } from '../../shared/money/money'
import { useCategories, useRegisters } from '../../shared/supabase/useEvent'
import { useCreateRegister, useUpdateCategoryVat, useUpdateEvent } from './api/settings'
import { useSettings } from './useSettings'
import './settings.css'

export function SettingsPage() {
  const event = useCurrentEvent()
  const { data: registers = [] } = useRegisters(event.id)
  const { data: categories = [] } = useCategories(event.id)
  const { activeRegisterId, setActiveRegisterId } = useSettings()

  const updateEvent = useUpdateEvent()
  const createRegister = useCreateRegister(event.id)
  const updateCategoryVat = useUpdateCategoryVat(event.id)

  const [newRegisterName, setNewRegisterName] = useState('')
  const [newRegisterCode, setNewRegisterCode] = useState('')

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
