import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Employee } from './api/employees'

interface ActiveEmployeeState {
  employee: Pick<Employee, 'id' | 'name' | 'role'> | null
  setEmployee: (employee: Pick<Employee, 'id' | 'name' | 'role'> | null) => void
}

/** Welke medewerker nu op dit gedeelde apparaat is ingelogd — een lokale,
 * per-apparaat voorkeur (net als de actieve kassa), niet gekoppeld aan de
 * Supabase-auth-sessie zelf (die blijft anoniem per kassa-apparaat). */
export const useActiveEmployee = create<ActiveEmployeeState>()(
  persist(
    (set) => ({
      employee: null,
      setEmployee: (employee) => set({ employee }),
    }),
    { name: 'standwerk-active-employee' },
  ),
)
