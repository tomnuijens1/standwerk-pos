/**
 * `crypto.randomUUID()` bestaat pas in recentere browser-/WebView-engines.
 * Op de Adyen-terminal (en potentieel oudere Android-WebViews) kan dat
 * ontbreken, wat de hele app-render laat crashen (blanco scherm, geen
 * foutmelding) zodra zo'n aanroep misgaat. `crypto.getRandomValues` bestaat
 * al veel langer (sinds IE11/Android 5) en is voldoende om hieruit zelf een
 * v4 UUID te bouwen.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40 // versie 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
