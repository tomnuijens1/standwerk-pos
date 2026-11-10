import { describe, expect, it } from 'vitest'
import { ManualProvider } from './ManualProvider'

describe('ManualProvider', () => {
  it('rondt een betaling direct af als geslaagd (geen echte terminal om op te wachten)', async () => {
    const provider = new ManualProvider()
    const { paymentId } = await provider.startPayment({ amountCents: 3500, reference: 'HOO-1', terminalId: 'manual' })
    expect(paymentId).toBeTruthy()
    expect(await provider.getStatus(paymentId)).toBe('succeeded')
  })

  it('geeft bij elke aanroep een nieuwe paymentId terug', async () => {
    const provider = new ManualProvider()
    const a = await provider.startPayment({ amountCents: 1000, reference: 'HOO-2', terminalId: 'manual' })
    const b = await provider.startPayment({ amountCents: 1000, reference: 'HOO-3', terminalId: 'manual' })
    expect(a.paymentId).not.toBe(b.paymentId)
  })

  it('refund levert een refundId op', async () => {
    const provider = new ManualProvider()
    const { refundId } = await provider.refund({ amountCents: 500, reference: 'RET-1', terminalId: 'manual' })
    expect(refundId).toBeTruthy()
  })
})
