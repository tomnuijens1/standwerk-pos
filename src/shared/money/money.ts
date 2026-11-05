/**
 * Alle geldbedragen in de app zijn hele centen. Het `Cents` brand-type voorkomt dat een
 * kale `number` (bijvoorbeeld een euro-bedrag uit een invoerveld) ongemerkt een
 * geldberekening in sluipt zonder expliciete conversie via `cents()`.
 */
export type Cents = number & { readonly __brand: 'Cents' }

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`Cents moet een geheel getal zijn, kreeg ${value}`)
  }
  return value as Cents
}

export function addCents(...values: Cents[]): Cents {
  return cents(values.reduce((sum, value) => sum + value, 0))
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return cents(a - b)
}

export function multiplyCents(amount: Cents, qty: number): Cents {
  if (!Number.isInteger(qty)) {
    throw new Error(`Aantal moet een geheel getal zijn, kreeg ${qty}`)
  }
  return cents(amount * qty)
}

/** Korting als percentage van het subtotaal, afgerond op de dichtstbijzijnde cent. */
export function applyPercentageDiscount(subtotal: Cents, percent: number): Cents {
  return cents(Math.round((subtotal * percent) / 100))
}

/** Korting als vast bedrag; kan het subtotaal nooit negatief maken. */
export function applyAmountDiscount(subtotal: Cents, amount: Cents): Cents {
  return cents(Math.min(subtotal, Math.max(0, amount)))
}

/** Wisselgeld bij contant afrekenen; weigert een tekort bedrag. */
export function calculateChange(amountDue: Cents, received: Cents): Cents {
  if (received < amountDue) {
    throw new Error('Ontvangen bedrag is lager dan het verschuldigde bedrag')
  }
  return cents(received - amountDue)
}

/**
 * Terug te betalen bedrag per stuk bij een retour van een bon met korting, pro rata
 * verdeeld: unit = oorspronkelijke prijs x (totaal / subtotaal) van de ORIGINELE bon.
 */
export function proRataRefundUnit(originalUnitPrice: Cents, originalTotal: Cents, originalSubtotal: Cents): Cents {
  if (originalSubtotal === 0) return cents(0)
  return cents(Math.round((originalUnitPrice * originalTotal) / originalSubtotal))
}

export function formatEuro(value: Cents): string {
  // Intl geeft een non-breaking space tussen € en het bedrag; normaliseer naar een
  // gewone spatie zodat UI-strings voorspelbaar vergelijkbaar/testbaar blijven.
  return (value / 100)
    .toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
    .replace(' ', ' ')
}

/**
 * Leest Nederlandse bedragnotatie ("12,50", "1.234,50") maar ook plain "12.50" en
 * levert hele centen. Gebruikt door zowel handmatige invoer als Excel-import.
 */
export function parseEuroInputToCents(input: string): Cents {
  let normalized = input.trim().replace(/[€\s]/g, '')
  if (normalized === '') {
    throw new Error('Leeg bedrag')
  }

  const hasComma = normalized.includes(',')
  const hasDot = normalized.includes('.')

  if (hasComma && hasDot) {
    // Laatste scheidingsteken is de decimaalscheider, de rest zijn duizendtal-scheiders.
    normalized =
      normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(/,/g, '')
  } else if (hasComma) {
    normalized = normalized.replace(',', '.')
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) {
    throw new Error(`Ongeldig bedrag: "${input}"`)
  }
  return cents(Math.round(value * 100))
}
