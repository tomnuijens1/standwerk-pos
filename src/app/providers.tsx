import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Voorraad/producten/bonnen worden vers gehouden door de Supabase
            // Realtime-subscriptions, niet door polling (zie features/realtime).
            staleTime: Number.POSITIVE_INFINITY,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
