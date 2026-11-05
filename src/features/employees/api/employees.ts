import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/supabase/client'

export interface Employee {
  id: string
  name: string
  role: 'cashier' | 'manager'
  active: boolean
}

export function useEmployees(eventId: string) {
  return useQuery({
    queryKey: ['employees', eventId],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role, active')
        .eq('event_id', eventId)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateEmployee(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; pincode: string; role: 'cashier' | 'manager' }) => {
      const { data, error } = await supabase.rpc('create_employee', {
        p_event_id: eventId,
        p_name: input.name,
        p_pincode: input.pincode,
        p_role: input.role,
      })
      if (error) throw error
      return data[0]
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', eventId] }),
  })
}

export function useDeactivateEmployee(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase.rpc('deactivate_employee', { p_employee_id: employeeId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', eventId] }),
  })
}

/** Zoekt de medewerker bij een pincode. Geeft null terug als er geen match is
 * (fout pincode) — geen aparte foutmelding, zodat je niet kan raden of een
 * pincode "bijna goed" was. */
export async function verifyPincode(eventId: string, pincode: string): Promise<Pick<Employee, 'id' | 'name' | 'role'> | null> {
  const { data, error } = await supabase.rpc('verify_employee_pincode', { p_event_id: eventId, p_pincode: pincode })
  if (error) throw error
  return data[0] ?? null
}
