import { describe, expect, it } from 'vitest'
import {
  addCents,
  applyAmountDiscount,
  applyPercentageDiscount,
  calculateChange,
  cents,
  formatEuro,
  multiplyCents,
  parseEuroInputToCents,
  proRataRefundUnit,
  subtractCents,
} from './money'

describe('cents', () => {
  it('accepteert gehele getallen', () => {
    expect(cents(1250)).toBe(1250)
  })

  it('gooit een fout bij een niet-geheel getal', () => {
    expect(() => cents(12.5)).toThrow()
  })
})

describe('addCents / subtractCents / multiplyCents', () => {
  it('telt meerdere bedragen op', () => {
    expect(addCents(cents(100), cents(250), cents(50))).toBe(cents(400))
  })

  it('trekt af', () => {
    expect(subtractCents(cents(1000), cents(300))).toBe(cents(700))
  })

  it('vermenigvuldigt met een geheel aantal', () => {
    expect(multiplyCents(cents(350), 3)).toBe(cents(1050))
  })

  it('weigert een niet-geheel aantal', () => {
    expect(() => multiplyCents(cents(350), 1.5)).toThrow()
  })
})

describe('applyPercentageDiscount', () => {
  it('rondt af op hele centen bij een oneven percentage', () => {
    // 1999 * 0.15 = 299.85 -> 300
    expect(applyPercentageDiscount(cents(1999), 15)).toBe(cents(300))
  })

  it('werkt voor de snelknop-percentages 5/10/15/20', () => {
    expect(applyPercentageDiscount(cents(10000), 5)).toBe(cents(500))
    expect(applyPercentageDiscount(cents(10000), 10)).toBe(cents(1000))
    expect(applyPercentageDiscount(cents(10000), 20)).toBe(cents(2000))
  })
})

describe('applyAmountDiscount', () => {
  it('kapt de korting af op het subtotaal, nooit een negatief totaal', () => {
    expect(applyAmountDiscount(cents(500), cents(10000))).toBe(cents(500))
  })

  it('negeert een negatief kortingsbedrag', () => {
    expect(applyAmountDiscount(cents(500), cents(-100))).toBe(cents(0))
  })

  it('past een normaal bedrag gewoon toe', () => {
    expect(applyAmountDiscount(cents(5000), cents(700))).toBe(cents(700))
  })
})

describe('calculateChange', () => {
  it('geeft het exacte wisselgeld terug in centen', () => {
    expect(calculateChange(cents(6300), cents(10000))).toBe(cents(3700))
  })

  it('weigert een ontvangen bedrag lager dan het verschuldigde bedrag', () => {
    expect(() => calculateChange(cents(6300), cents(5000))).toThrow()
  })

  it('staat precies gepast betalen toe', () => {
    expect(calculateChange(cents(6300), cents(6300))).toBe(cents(0))
  })
})

describe('proRataRefundUnit', () => {
  it('berekent het terug te betalen bedrag per stuk na korting', () => {
    // bon: subtotaal 7000, korting 700, totaal 6300 -> unit van prijs 3500 wordt round(3500*6300/7000)=3150
    expect(proRataRefundUnit(cents(3500), cents(6300), cents(7000))).toBe(cents(3150))
  })

  it('geeft de volle prijs terug als er geen korting was', () => {
    expect(proRataRefundUnit(cents(3500), cents(7000), cents(7000))).toBe(cents(3500))
  })
})

describe('formatEuro', () => {
  // Intl.NumberFormat('nl-NL', {style:'currency'}) scheidt € en bedrag met een
  // non-breaking space (U+00A0), niet een gewone spatie.
  it('formatteert centen als Nederlandse euro-notatie', () => {
    expect(formatEuro(cents(1250))).toBe('€ 12,50')
  })

  it('formatteert nul correct', () => {
    expect(formatEuro(cents(0))).toBe('€ 0,00')
  })
})

describe('parseEuroInputToCents', () => {
  it('leest een eenvoudig bedrag met komma', () => {
    expect(parseEuroInputToCents('12,50')).toBe(cents(1250))
  })

  it('leest een bedrag met duizendtal-punt en decimale komma', () => {
    expect(parseEuroInputToCents('1.234,50')).toBe(cents(123450))
  })

  it('leest een bedrag met decimale punt', () => {
    expect(parseEuroInputToCents('12.50')).toBe(cents(1250))
  })

  it('leest een heel bedrag zonder decimalen', () => {
    expect(parseEuroInputToCents('35')).toBe(cents(3500))
  })

  it('negeert een euroteken en spaties', () => {
    expect(parseEuroInputToCents('€ 12,50')).toBe(cents(1250))
  })

  it('gooit een fout bij een ongeldig bedrag', () => {
    expect(() => parseEuroInputToCents('abc')).toThrow()
  })

  it('gooit een fout bij een leeg bedrag', () => {
    expect(() => parseEuroInputToCents('')).toThrow()
  })
})
