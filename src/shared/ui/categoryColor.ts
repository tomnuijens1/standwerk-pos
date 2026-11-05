/**
 * Wijst elke categorie een vaste kleur toe op basis van haar alfabetische positie
 * tussen alle categorieën van het event (doc 05: 8 vaste categoriekleuren, op
 * volgorde van de alfabetisch gesorteerde categorieën).
 */
export function categoryColorVar(categoryName: string, allCategoryNames: string[]): string {
  const sorted = [...new Set(allCategoryNames)].sort((a, b) => a.localeCompare(b, 'nl'))
  const index = sorted.indexOf(categoryName)
  const slot = index === -1 ? 0 : index % 8
  return `var(--cat-${slot + 1})`
}
