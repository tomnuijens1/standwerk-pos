import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../shared/supabase/client'

/**
 * Houdt kassa's realtime gesynchroniseerd: zodra een andere kassa voorraad
 * afboekt of een bon/retour aanmaakt, worden de relevante TanStack Query-caches
 * ongeldig gemaakt zodat ze opnieuw ophalen. Geen polling.
 */
export function useRealtimeSync(eventId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!eventId) return

    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `event_id=eq.${eventId}` },
        () => queryClient.invalidateQueries({ queryKey: ['products', eventId] }),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stock_movements', filter: `event_id=eq.${eventId}` },
        () => queryClient.invalidateQueries({ queryKey: ['stockMovements', eventId] }),
      )
      // receipts/sales/refunds hebben geen event_id-kolom (alleen via registers);
      // met één event per fase-1-opzet is ongefilterd invalideren hier volstaat.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'receipts' }, () =>
        queryClient.invalidateQueries({ queryKey: ['receipts'] }),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, queryClient])
}
