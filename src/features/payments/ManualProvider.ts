import type { PaymentProvider, PaymentStatus, RefundInput, StartPaymentInput } from './PaymentProvider'

/**
 * Doet het huidige gedrag na (doc 04): de medewerker tikt op Pin/QR en de kassa
 * neemt aan dat het gelukt is — er is geen echte terminal. Dit houdt de
 * "2 tikken"-snelheid die er nu al is, terwijl de rest van de app al wel via de
 * PaymentProvider-interface praat. Zo kan een echte leverancier er later achter
 * gezet worden zonder de kassa-flow te hoeven aanpassen.
 */
export class ManualProvider implements PaymentProvider {
  async startPayment(_input: StartPaymentInput): Promise<{ paymentId: string }> {
    return { paymentId: crypto.randomUUID() }
  }

  async getStatus(_paymentId: string): Promise<PaymentStatus> {
    return 'succeeded'
  }

  async cancel(_paymentId: string): Promise<void> {
    // Niets te annuleren: er is geen echte terminal-transactie in deze provider.
  }

  async refund(_input: RefundInput): Promise<{ refundId: string }> {
    return { refundId: crypto.randomUUID() }
  }
}
