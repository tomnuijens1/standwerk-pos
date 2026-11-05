import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addCents, applyAmountDiscount, applyPercentageDiscount, cents, multiplyCents } from '../../../shared/money/money'
import type { Cents } from '../../../shared/money/money'
import type { Product } from '../../../shared/lib/product'

export interface CartLine {
  productId: string
  qty: number
}

export type Discount = { type: 'percentage'; value: number } | { type: 'amount'; value: Cents }

/** Omruiltegoed van een retour, te verzilveren op de eerstvolgende bon. */
export interface Credit {
  refundId: string
  amountCents: Cents
  label: string
}

interface CartState {
  lines: CartLine[]
  discount: Discount | null
  credit: Credit | null
  addLine: (productId: string) => void
  changeQty: (productId: string, delta: number) => void
  removeLine: (productId: string) => void
  setDiscount: (discount: Discount | null) => void
  setCredit: (credit: Credit | null) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      discount: null,
      credit: null,
      addLine: (productId) =>
        set((state) => {
          const existing = state.lines.find((l) => l.productId === productId)
          if (existing) {
            return {
              lines: state.lines.map((l) => (l.productId === productId ? { ...l, qty: l.qty + 1 } : l)),
            }
          }
          return { lines: [...state.lines, { productId, qty: 1 }] }
        }),
      changeQty: (productId, delta) =>
        set((state) => ({
          lines: state.lines
            .map((l) => (l.productId === productId ? { ...l, qty: l.qty + delta } : l))
            .filter((l) => l.qty > 0),
        })),
      removeLine: (productId) => set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),
      setDiscount: (discount) => set({ discount }),
      setCredit: (credit) => set({ credit }),
      clear: () => set({ lines: [], discount: null, credit: null }),
    }),
    { name: 'standwerk-cart' },
  ),
)

export function cartTotals(lines: CartLine[], products: Product[], discount: Discount | null, credit: Credit | null = null) {
  const resolved = lines
    .map((line) => ({ line, product: products.find((p) => p.id === line.productId) }))
    .filter((x): x is { line: CartLine; product: Product } => Boolean(x.product))

  const subtotal =
    resolved.length === 0 ? cents(0) : addCents(...resolved.map((x) => multiplyCents(x.product.priceCents, x.line.qty)))

  const discountCents = !discount
    ? cents(0)
    : discount.type === 'percentage'
      ? applyPercentageDiscount(subtotal, discount.value)
      : applyAmountDiscount(subtotal, discount.value)

  const total = cents(subtotal - discountCents)
  const creditCents = credit?.amountCents ?? cents(0)
  // Bij omruilen betaalt de klant alleen het verschil bij; is het tegoed hoger
  // dan de bon, dan kan er nog niet afgerekend worden (amountDue wordt negatief
  // teruggegeven zodat de aanroeper dat kan detecteren en blokkeren).
  const amountDue = cents(total - creditCents)

  return { resolved, subtotal, discountCents, total, creditCents, amountDue }
}
