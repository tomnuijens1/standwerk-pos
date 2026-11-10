import { ManualProvider } from './ManualProvider'
import type { PaymentProvider } from './PaymentProvider'

export type { PaymentProvider, PaymentStatus, RefundInput, StartPaymentInput } from './PaymentProvider'

let provider: PaymentProvider | null = null

/**
 * Enige plek in de app die weet welke PaymentProvider actief is. Zodra er een
 * echte AdyenProvider is (zie docs/04-betaalterminals.md), verandert alleen
 * deze functie — de rest van de app blijft tegen de PaymentProvider-interface
 * praten.
 */
export function getPaymentProvider(): PaymentProvider {
  provider ??= new ManualProvider()
  return provider
}
