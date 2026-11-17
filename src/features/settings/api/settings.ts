import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/supabase/client'

// Alle wijzigingen lopen via RPC's die server-side controleren of de
// meegegeven medewerker een manager is. De tabellen zelf zijn niet meer
// rechtstreeks beschrijfbaar (zie migratie 00007).

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: {
      id: string
      employeeId: string
      name?: string
      low_stock_default?: number
      opening_float_cents?: number
      return_days?: number
      max_discount_percent_without_manager?: number
    }) => {
      const { error } = await supabase.rpc('update_event_settings', {
        p_event_id: patch.id,
        p_employee_id: patch.employeeId,
        p_name: patch.name ?? null,
        p_low_stock_default: patch.low_stock_default ?? null,
        p_opening_float_cents: patch.opening_float_cents ?? null,
        p_return_days: patch.return_days ?? null,
        p_max_discount_percent: patch.max_discount_percent_without_manager ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event'] }),
  })
}

export function useCreateRegister(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; code: string; employeeId: string }) => {
      const { error } = await supabase.rpc('upsert_register', {
        p_event_id: eventId,
        p_employee_id: input.employeeId,
        p_name: input.name,
        p_code: input.code,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registers', eventId] }),
  })
}

export function useUpdateRegisterTerminal(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { registerId: string; terminalId: string | null; employeeId: string }) => {
      const { error } = await supabase.rpc('upsert_register', {
        p_event_id: eventId,
        p_employee_id: input.employeeId,
        p_register_id: input.registerId,
        p_terminal_id: input.terminalId,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registers', eventId] }),
  })
}

export function useUpdateCategoryVat(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; vatRateBp: number; employeeId: string }) => {
      const { error } = await supabase.rpc('update_category_vat', {
        p_category_id: input.id,
        p_employee_id: input.employeeId,
        p_vat_rate_bp: input.vatRateBp,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', eventId] }),
  })
}
