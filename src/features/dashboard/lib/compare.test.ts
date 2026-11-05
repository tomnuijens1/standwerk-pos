import { describe, expect, it } from 'vitest'
import { compare } from './compare'

describe('compare', () => {
  it('geeft null als er geen vorige periode is ("Alles")', () => {
    expect(compare(100, null)).toBeNull()
  })

  it('berekent een stijging in procenten', () => {
    expect(compare(150, 100)).toEqual({ percent: 50, direction: 'up' })
  })

  it('berekent een daling in procenten', () => {
    expect(compare(50, 100)).toEqual({ percent: -50, direction: 'down' })
  })

  it('behandelt een vorige waarde van 0 als 100% stijging wanneer er nu wel omzet is', () => {
    expect(compare(50, 0)).toEqual({ percent: 100, direction: 'up' })
  })

  it('behandelt 0 naar 0 als vlak', () => {
    expect(compare(0, 0)).toEqual({ percent: 0, direction: 'flat' })
  })
})
