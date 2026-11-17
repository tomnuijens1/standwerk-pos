import { AdyenProvider } from './AdyenProvider'
import { ManualProvider } from './ManualProvider'
import type { PaymentProvider } from './PaymentProvider'

export type { PaymentProvider, PaymentStatus, RefundInput, StartPaymentInput } from './PaymentProvider'

const manual = new ManualProvider()

/**
 * Enige plek in de app die bepaalt welke PaymentProvider actief is.
 *
 * Is er voor de kassa een terminal gekoppeld, dan gaat de betaling via de
 * echte terminal. Zo niet, dan valt de kassa terug op handmatig bevestigen —
 * precies het gedrag van vóór de terminal-koppeling, zodat een stand zonder
 * terminal gewoon door kan verkopen.
 *
 * De server controleert zelf nogmaals of de kassa een terminal heeft en of de
 * medewerker mag doen wat hij vraagt; deze keuze hier is puur voor de juiste
 * gebruikerservaring.
 */
export function getPaymentProvider(options: {
  hasTerminal: boolean
  registerId: string
  employeeId: string | null
}): PaymentProvider {
  if (!options.hasTerminal || !options.employeeId) return manual
  return new AdyenProvider(options.registerId, options.employeeId)
}
