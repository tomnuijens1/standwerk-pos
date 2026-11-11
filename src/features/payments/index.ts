import { AdyenProvider } from './AdyenProvider'
import { ManualProvider } from './ManualProvider'
import type { PaymentProvider } from './PaymentProvider'

export type { PaymentProvider, PaymentStatus, RefundInput, StartPaymentInput } from './PaymentProvider'

const manual = new ManualProvider()
const adyenBySaleId = new Map<string, AdyenProvider>()

/**
 * Enige plek in de app die bepaalt welke PaymentProvider actief is.
 *
 * Is er voor de kassa een terminal-ID (Adyen POIID) ingesteld, dan gaat de
 * betaling via de echte terminal. Zo niet, dan valt de kassa terug op
 * handmatig bevestigen — precies het gedrag van vóór de terminal-koppeling,
 * zodat een stand zonder terminal gewoon door kan verkopen.
 */
export function getPaymentProvider(options: { terminalId?: string | null; registerId: string }): PaymentProvider {
  if (!options.terminalId) return manual

  // SaleID identificeert het kassasysteem richting Adyen; per kassa stabiel
  // houden zodat statusopvragingen bij de juiste kassa horen.
  const saleId = options.registerId.replace(/-/g, '').slice(0, 10)
  let provider = adyenBySaleId.get(saleId)
  if (!provider) {
    provider = new AdyenProvider(saleId)
    adyenBySaleId.set(saleId, provider)
  }
  return provider
}
