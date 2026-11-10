/**
 * Adapter-interface voor betaalterminal-leveranciers (zie docs/04-betaalterminals.md).
 * Elke leverancier (Adyen, CCV, ...) implementeert dit zelfde contract, zodat de
 * rest van de app nooit hoeft te weten welke leverancier er daadwerkelijk achter
 * zit. API-sleutels van een echte leverancier horen nooit in deze laag van de
 * frontend — alleen een provider die zelf een server-endpoint (Supabase Edge
 * Function) aanroept waar de sleutel staat.
 */
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled'

export interface StartPaymentInput {
  amountCents: number
  reference: string // bonnummer of een tijdelijke referentie vóór het bonnummer bekend is
  terminalId: string
}

export interface RefundInput {
  paymentId?: string
  amountCents: number
  reference: string
  terminalId: string
}

export interface PaymentProvider {
  startPayment(input: StartPaymentInput): Promise<{ paymentId: string }>
  getStatus(paymentId: string): Promise<PaymentStatus>
  cancel(paymentId: string): Promise<void>
  refund(input: RefundInput): Promise<{ refundId: string }>
}
