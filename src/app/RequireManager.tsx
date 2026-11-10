import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useActiveEmployee } from '../features/employees/useActiveEmployee'

/** Blokkeert een scherm voor iedereen behalve een ingelogde manager — ook bij
 * rechtstreeks navigeren naar de URL (het menu verbergt de link al, maar dat
 * alleen zou te omzeilen zijn door 'm gewoon in te typen). */
export function RequireManager({ children }: { children: ReactNode }) {
  const { employee } = useActiveEmployee()
  if (employee?.role !== 'manager') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
