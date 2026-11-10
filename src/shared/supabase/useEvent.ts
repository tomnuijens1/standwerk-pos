import { useQuery } from '@tanstack/react-query'
import { supabase } from './client'

/**
 * Fase 1 heeft maar één event tegelijk (meerdere events/tours is fase 3), dus we
 * lezen gewoon de eerste (en enige) rij uit de events-tabel.
 */
export function useEvent() {
  return useQuery({
    queryKey: ['event'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*').limit(1).single()
      if (error) throw error
      return data
    },
  })
}

export function useCategories(eventId: string | undefined) {
  return useQuery({
    queryKey: ['categories', eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('event_id', eventId!).order('name')
      if (error) throw error
      return data
    },
    enabled: !!eventId,
  })
}

export function useRegisters(eventId: string | undefined) {
  return useQuery({
    queryKey: ['registers', eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from('registers').select('*').eq('event_id', eventId!).order('name')
      if (error) throw error
      return data
    },
    enabled: !!eventId,
  })
}
