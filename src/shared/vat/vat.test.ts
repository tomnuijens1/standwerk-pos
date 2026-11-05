import { describe, expect, it } from 'vitest'
import { cents } from '../money/money'
import { totalVatAmount, vatAmountInclusive, vatRateBp, vatRateToPercent } from './vat'

describe('vatRateBp', () => {
  it('zet een percentage om naar basispunten', () => {
    expect(vatRateBp(21)).toBe(2100)
    expect(vatRateBp(9)).toBe(900)
    expect(vatRateBp(0)).toBe(0)
  })

  it('weigert een negatief percentage', () => {
    expect(() => vatRateBp(-5)).toThrow()
  })
})

describe('vatRateToPercent', () => {
  it('zet basispunten terug om naar een percentage', () => {
    expect(vatRateToPercent(vatRateBp(21))).toBe(21)
  })
})

describe('vatAmountInclusive', () => {
  it('berekent 21% btw uit een bedrag incl. btw', () => {
    // 35,00 incl. 21% btw: 35 / 1,21 = 28,9256... -> btw = 6,0744... -> 607 cent
    expect(vatAmountInclusive(cents(3500), vatRateBp(21))).toBe(cents(607))
  })

  it('werkt ook voor het 9%-tarief, bijvoorbeeld een tourboek', () => {
    expect(vatAmountInclusive(cents(2000), vatRateBp(9))).toBe(cents(165))
  })

  it('geeft 0 btw bij een 0%-tarief', () => {
    expect(vatAmountInclusive(cents(2000), vatRateBp(0))).toBe(cents(0))
  })
})

describe('totalVatAmount', () => {
  it('telt btw per regel op, niet over het bonniveau totaal', () => {
    // regressietest die het "btw per product i.p.v. globaal"-principe bewaakt
    const lines = [
      { amountIncl: cents(3500), rate: vatRateBp(21) }, // shirt: 607 cent btw
      { amountIncl: cents(2000), rate: vatRateBp(9) }, // tourboek: 165 cent btw
    ]
    expect(totalVatAmount(lines)).toBe(cents(607 + 165))
  })
})
