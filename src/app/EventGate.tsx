import { createContext, type ReactNode, useContext } from 'react'
import { useEvent } from '../shared/supabase/useEvent'
import { useRealtimeSync } from '../features/realtime/useRealtimeSync'

interface EventRow {
  id: string
  name: string
  low_stock_default: number
  opening_float_cents: number
  return_days: number
}

const EventContext = createContext<EventRow | null>(null)

/** Fase 1: precies één event. Laadt het, houdt het realtime gesynchroniseerd en
 * geeft het door aan alle schermen die de event_id nodig hebben. */
export function EventGate({ children }: { children: ReactNode }) {
  const { data: event, isLoading, error } = useEvent()
  useRealtimeSync(event?.id)

  if (error) {
    return (
      <div className="auth-gate-error">
        Geen event gevonden. Heb je supabase/migrations/00002_seed_and_settings_grants.sql al gedraaid?
        <br />
        <small>Details: {error.message}</small>
      </div>
    )
  }

  if (isLoading || !event) {
    return <div className="auth-gate-loading">Event laden…</div>
  }

  return <EventContext.Provider value={event}>{children}</EventContext.Provider>
}

export function useCurrentEvent(): EventRow {
  const event = useContext(EventContext)
  if (!event) throw new Error('useCurrentEvent moet binnen EventGate gebruikt worden')
  return event
}
