import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/supabase/client'

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: { id: string; name?: string; low_stock_default?: number; opening_float_cents?: number; return_days?: number }) => {
      const { id, ...fields } = patch
      const { error } = await supabase.from('events').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event'] }),
  })
}

export function useCreateRegister(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; code: string }) => {
      const { error } = await supabase.from('registers').insert({ event_id: eventId, name: input.name, code: input.code })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registers', eventId] }),
  })
}

export function useUpdateCategoryVat(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; vatRateBp: number }) => {
      const { error } = await supabase.from('categories').update({ default_vat_rate_bp: input.vatRateBp }).eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', eventId] }),
  })
}
