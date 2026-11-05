import { type Cents, cents } from '../money/money'

/**
 * Btw-tarief in basispunten (2100 = 21,00%, 900 = 9,00%) in plaats van een decimaal
 * percentage, om dezelfde reden als bedragen in centen: geen float-afrondingsgedoe.
 */
export type VatRateBp = number & { readonly __brand: 'VatRateBp' }

export function vatRateBp(percent: number): VatRateBp {
  const bp = Math.round(percent * 100)
  if (!Number.isInteger(bp) || bp < 0) {
    throw new Error(`Ongeldig btw-percentage: ${percent}`)
  }
  return bp as VatRateBp
}

export function vatRateToPercent(rate: VatRateBp): number {
  return rate / 100
}

/**
 * price_cents in het datamodel is altijd inclusief btw (net als in het prototype en
 * doc 02). De btw wordt teruggerekend uit het bedrag incl. btw.
 */
export function vatAmountInclusive(amountIncl: Cents, rate: VatRateBp): Cents {
  const divisor = 1 + rate / 10000
  return cents(Math.round(amountIncl - amountIncl / divisor))
}

export interface VatLine {
  amountIncl: Cents
  rate: VatRateBp
}

/**
 * Een bon kan regels met verschillende btw-tarieven bevatten (bijv. 21% merchandise en
 * 9% tourboek). De btw op het bontotaal is de som van de btw per regel, nooit één
 * percentage over het totale bedrag.
 */
export function totalVatAmount(lines: VatLine[]): Cents {
  return cents(lines.reduce((sum, line) => sum + vatAmountInclusive(line.amountIncl, line.rate), 0))
}
