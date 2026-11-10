import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Welke kassa dit apparaat gebruikt is een lokale, per-apparaat voorkeur (net als
 * in het prototype) — geen eventgegeven. Event, categorieën en kassa's zelf komen
 * uit Supabase (zie app/EventGate.tsx en shared/supabase/useEvent.ts).
 */
interface SettingsState {
  activeRegisterId: string | null
  setActiveRegisterId: (id: string) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      activeRegisterId: null,
      setActiveRegisterId: (id) => set({ activeRegisterId: id }),
    }),
    { name: 'standwerk-settings' },
  ),
)
