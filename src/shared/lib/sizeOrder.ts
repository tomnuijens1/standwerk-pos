const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL']

/** Sorteert varianten in logische maatvolgorde (S, M, L, XL...); onbekende
 * waarden (bijv. kleuren, of geen variant) komen na de bekende maten,
 * alfabetisch. */
export function sortVariants<T extends { variant: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.variant.toUpperCase())
    const bi = SIZE_ORDER.indexOf(b.variant.toUpperCase())
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.variant.localeCompare(b.variant, 'nl')
  })
}
