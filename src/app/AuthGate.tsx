import { type ReactNode, useEffect, useState } from 'react'
import { ensureDeviceSession } from '../shared/supabase/client'

/**
 * Elk kassa-apparaat krijgt een anonieme Supabase-sessie vóór er data wordt
 * opgehaald, anders levert RLS (policies gelden alleen voor "authenticated")
 * stilzwijgend lege resultaten op in plaats van een foutmelding.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureDeviceSession()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return <div className="auth-gate-error">Kon geen verbinding maken met de database: {error}</div>
  }

  if (!ready) {
    return <div className="auth-gate-loading">Verbinden…</div>
  }

  return <>{children}</>
}
