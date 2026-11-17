import type { ReactNode } from 'react'
import { useCurrentEvent } from './EventGate'
import { useEmployees } from '../features/employees/api/employees'
import { FirstManagerSetup } from '../features/employees/components/FirstManagerSetup'

/**
 * Zorgt dat een gloednieuw event altijd eerst een manager krijgt. Zonder deze
 * stap zou niemand kunnen inloggen (en dus niets kunnen boeken), omdat alle
 * schrijfacties sinds migratie 00007 een geldige medewerker vereisen.
 */
export function EmployeeGate({ children }: { children: ReactNode }) {
  const event = useCurrentEvent()
  const { data: employees, isLoading } = useEmployees(event.id)

  if (isLoading) return <div className="auth-gate-loading">Laden…</div>

  const hasActiveEmployee = (employees ?? []).some((e) => e.active)
  if (!hasActiveEmployee) return <FirstManagerSetup />

  return <>{children}</>
}
