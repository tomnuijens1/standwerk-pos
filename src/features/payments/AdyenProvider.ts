import { supabase } from '../../shared/supabase/client'
import { uuid } from '../../shared/lib/uuid'
import type { PaymentProvider, PaymentStatus, RefundInput, StartPaymentInput } from './PaymentProvider'

/**
 * Praat met een Adyen-betaalterminal via de Terminal API, maar nooit
 * rechtstreeks: alle verzoeken lopen via de "adyen-terminal" Edge Function,
 * waar de geheime API-sleutel staat (docs/04-betaalterminals.md). Deze klasse
 * kent die sleutel dus niet.
 *
 * `terminalId` in de PaymentProvider-interface is bij Adyen de POIID — het
 * terminal-ID in de vorm "[model]-[serienummer]", bijv. "S1F2-000158225400001".
 */
export class AdyenProvider implements PaymentProvider {
  // ServiceID moet uniek zijn binnen 48 uur en mag maximaal 10 tekens zijn.
  // We onthouden per betaling welke ServiceID gebruikt is, omdat een
  // statusopvraging naar díe ServiceID moet verwijzen.
  private serviceIdByPayment = new Map<string, { serviceId: string; poiId: string }>()

  private readonly saleId: string

  constructor(saleId: string) {
    this.saleId = saleId
  }

  private newServiceId(): string {
    return uuid().replace(/-/g, '').slice(0, 10)
  }

  private async call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.functions.invoke('adyen-terminal', { body })
    if (error) throw new Error(`Terminal onbereikbaar: ${error.message}`)
    return data as Record<string, unknown>
  }

  async startPayment(input: StartPaymentInput): Promise<{ paymentId: string }> {
    const serviceId = this.newServiceId()
    const paymentId = uuid()

    const response = await this.call({
      action: 'payment',
      poiId: input.terminalId,
      saleId: this.saleId,
      serviceId,
      amountCents: input.amountCents,
      currency: 'EUR',
      reference: input.reference,
    })

    this.serviceIdByPayment.set(paymentId, { serviceId, poiId: input.terminalId })

    // De /sync-endpoint wacht op de klant; meestal is het resultaat hier al
    // bekend. Zo niet, dan haalt getStatus() het later alsnog op.
    const immediate = readPaymentResult(response)
    if (immediate) {
      this.lastKnownStatus.set(paymentId, immediate)
    }

    return { paymentId }
  }

  private lastKnownStatus = new Map<string, PaymentStatus>()

  async getStatus(paymentId: string): Promise<PaymentStatus> {
    const known = this.lastKnownStatus.get(paymentId)
    if (known && known !== 'pending') return known

    const context = this.serviceIdByPayment.get(paymentId)
    if (!context) return 'failed'

    const response = await this.call({
      action: 'status',
      poiId: context.poiId,
      saleId: this.saleId,
      serviceId: this.newServiceId(),
      originalServiceId: context.serviceId,
    })

    const status = readStatusResult(response)
    this.lastKnownStatus.set(paymentId, status)
    return status
  }

  async cancel(paymentId: string): Promise<void> {
    const context = this.serviceIdByPayment.get(paymentId)
    if (!context) return

    await this.call({
      action: 'abort',
      poiId: context.poiId,
      saleId: this.saleId,
      serviceId: this.newServiceId(),
      originalServiceId: context.serviceId,
    })
  }

  async refund(input: RefundInput): Promise<{ refundId: string }> {
    const response = await this.call({
      action: 'refund',
      poiId: input.terminalId,
      saleId: this.saleId,
      serviceId: this.newServiceId(),
      amountCents: input.amountCents,
      currency: 'EUR',
      reference: input.reference,
    })

    const result = readRefundResult(response)
    if (!result.success) {
      throw new Error(result.message ?? 'Terugbetaling op de terminal is niet gelukt')
    }
    return { refundId: result.refundId ?? uuid() }
  }
}

// --- Hulpfuncties om Adyen's geneste antwoordstructuur uit te lezen ---------
// Adyen's Terminal API antwoordt met SaleToPOIResponse > <Category>Response >
// Response > Result ("Success" | "Failure") en een AdditionalResponse met
// details. Deze functies vertalen dat naar onze eigen PaymentStatus.

function get(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj)
}

function mapResult(result: unknown, errorCondition: unknown): PaymentStatus {
  if (result === 'Success') return 'succeeded'
  if (result === 'Failure') {
    return errorCondition === 'Cancel' || errorCondition === 'Aborted' ? 'cancelled' : 'failed'
  }
  return 'pending'
}

function readPaymentResult(response: Record<string, unknown>): PaymentStatus | null {
  const result = get(response, ['SaleToPOIResponse', 'PaymentResponse', 'Response', 'Result'])
  if (result === undefined) return null
  const errorCondition = get(response, ['SaleToPOIResponse', 'PaymentResponse', 'Response', 'ErrorCondition'])
  return mapResult(result, errorCondition)
}

function readStatusResult(response: Record<string, unknown>): PaymentStatus {
  // Een nog lopende betaling geeft ErrorCondition "InProgress" terug.
  const statusResponse = get(response, ['SaleToPOIResponse', 'TransactionStatusResponse'])
  const errorCondition = get(statusResponse, ['Response', 'ErrorCondition'])
  if (errorCondition === 'InProgress') return 'pending'

  const nested = get(statusResponse, ['RepeatedMessageResponse', 'RepeatedResponseMessageBody', 'PaymentResponse', 'Response'])
  if (nested) {
    return mapResult(get(nested, ['Result']), get(nested, ['ErrorCondition']))
  }

  return mapResult(get(statusResponse, ['Response', 'Result']), errorCondition)
}

function readRefundResult(response: Record<string, unknown>): { success: boolean; refundId?: string; message?: string } {
  const reversal = get(response, ['SaleToPOIResponse', 'ReversalResponse'])
  const result = get(reversal, ['Response', 'Result'])
  const refundId = get(reversal, ['POIData', 'POITransactionID', 'TransactionID'])
  return {
    success: result === 'Success',
    refundId: typeof refundId === 'string' ? refundId : undefined,
    message: typeof get(reversal, ['Response', 'AdditionalResponse']) === 'string' ? (get(reversal, ['Response', 'AdditionalResponse']) as string) : undefined,
  }
}
