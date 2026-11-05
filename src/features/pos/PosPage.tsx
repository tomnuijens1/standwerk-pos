import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentEvent } from '../../app/EventGate'
import { type Cents, cents, formatEuro } from '../../shared/money/money'
import { categoryColorVar } from '../../shared/ui/categoryColor'
import { useRegisters } from '../../shared/supabase/useEvent'
import { ReturnFlow } from '../returns/ReturnFlow'
import { useSettings } from '../settings/useSettings'
import { useCheckout } from './api/checkout'
import { useProducts } from './api/products'
import { CashPaymentModal } from './components/CashPaymentModal'
import { DiscountModal } from './components/DiscountModal'
import { VariantPickerModal } from './components/VariantPickerModal'
import { cartTotals, useCart } from './hooks/useCart'
import { groupProducts, type ProductGroup } from './lib/groupProducts'
import './pos.css'

// Bonnummer-formaat: kassacode + oplopend nummer, bijv. "HOO-12" (zie
// registers.current_receipt_no in supabase/migrations/00001_init.sql).
const RECEIPT_PATTERN = /^[a-z]{1,4}-\d+$/i

export function PosPage() {
  const event = useCurrentEvent()
  const navigate = useNavigate()
  const { data: products = [], isLoading } = useProducts(event.id)
  const { data: registers = [] } = useRegisters(event.id)
  const checkout = useCheckout(event.id)

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [variantGroup, setVariantGroup] = useState<ProductGroup | null>(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showCash, setShowCash] = useState(false)
  const [showReturn, setShowReturn] = useState(false)

  const { lines, discount, credit, addLine, changeQty, setDiscount, setCredit, clear } = useCart()
  const { activeRegisterId, setActiveRegisterId } = useSettings()

  const activeRegister = registers.find((r) => r.id === activeRegisterId) ?? registers[0]

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'nl')), [products])

  const groups = useMemo(() => groupProducts(products), [products])

  const visibleGroups = useMemo(
    () =>
      groups
        .filter((g) => !activeCategory || g.category === activeCategory)
        .filter((g) => (query ? `${g.name} ${g.items.map((i) => i.sku).join(' ')}`.toLowerCase().includes(query.toLowerCase()) : true)),
    [groups, activeCategory, query],
  )

  const { resolved, subtotal, discountCents, total, creditCents, amountDue } = cartTotals(lines, products, discount, credit)
  const canPay = resolved.length > 0 && amountDue >= 0

  function handleTileClick(group: ProductGroup) {
    if (group.items.length === 1) {
      addLine(group.items[0].id)
    } else {
      setVariantGroup(group)
    }
  }

  function handleSearchEnter() {
    const value = query.trim()
    if (!value) return
    setSearchError(null)

    if (RECEIPT_PATTERN.test(value)) {
      navigate(`/transacties?zoek=${encodeURIComponent(value)}`)
      return
    }

    const match = products.find((p) => p.sku.toLowerCase() === value.toLowerCase() || p.barcode?.toLowerCase() === value.toLowerCase())
    if (match) {
      addLine(match.id)
      setQuery('')
      return
    }

    setSearchError(`"${value}" niet gevonden`)
  }

  function finalizeSale(method: 'pin' | 'cash' | 'qr', receivedCents: Cents | null) {
    if (!canPay || !activeRegister) return

    checkout.mutate(
      {
        registerId: activeRegister.id,
        method,
        items: resolved.map(({ line, product }) => ({
          product_id: product.id,
          qty: line.qty,
          unit_price_cents: product.priceCents,
        })),
        discountCents,
        receivedCents,
        creditCents,
        creditRefId: credit?.refundId ?? null,
      },
      {
        onSuccess: ({ receipt_number }) => {
          clear()
          setShowCash(false)
          window.alert(`Bon ${activeRegister.code}-${receipt_number} afgerekend: ${formatEuro(total)}`)
        },
        onError: (e: Error) => {
          window.alert(`Afrekenen mislukt: ${e.message}`)
        },
      },
    )
  }

  if (isLoading) return <div className="auth-gate-loading">Producten laden…</div>

  return (
    <div className="pos">
      <div>
        <div className="pos-tools search">
          <input
            placeholder="Zoeken, barcode of SKU scannen, of bonnummer…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSearchError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchEnter()
            }}
          />
          {searchError && <p className="error-text search-error">{searchError}</p>}
        </div>
        {registers.length > 1 && (
          <div className="chips">
            {registers.map((r) => (
              <button key={r.id} className="chip" aria-pressed={activeRegister?.id === r.id} onClick={() => setActiveRegisterId(r.id)}>
                {r.name}
              </button>
            ))}
          </div>
        )}
        <div className="chips">
          <button className="chip" aria-pressed={activeCategory === null} onClick={() => setActiveCategory(null)}>
            Alles
          </button>
          {categories.map((cat) => (
            <button key={cat} className="chip" aria-pressed={activeCategory === cat} onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
        <div className="tiles">
          {visibleGroups.map((g) => (
            <button key={g.key} className="tile" disabled={g.totalStock === 0} onClick={() => handleTileClick(g)}>
              <span className="tile-cat" style={{ background: categoryColorVar(g.category, categories) }} />
              <span className="tile-name">{g.name}</span>
              <span className="tile-meta">
                <span>{formatEuro(g.priceCents)}</span>
                <span>
                  {g.totalStock === 0
                    ? 'Uitverkocht'
                    : g.items.length > 1
                      ? `${g.items.length} varianten`
                      : `${g.totalStock} op voorraad`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="cart">
        <div className="cart-head">
          <h2>Huidige bon · {activeRegister?.name ?? '…'}</h2>
          <div className="btns">
            <button className="discount-btn" onClick={() => setShowReturn(true)}>
              Retour of omruilen
            </button>
            {lines.length > 0 && (
              <button className="discount-btn" onClick={clear}>
                Leegmaken
              </button>
            )}
          </div>
        </div>
        <div className="cart-lines">
          {resolved.length === 0 && <div className="cart-empty">Nog geen producten. Tik op een tegel om toe te voegen.</div>}
          {resolved.map(({ line, product }) => (
            <div key={line.productId} className="cart-line">
              <div>
                <div className="cart-line-name">
                  {product.name}
                  {product.variant ? ` · ${product.variant}` : ''}
                </div>
                <div className="cart-line-sub">{formatEuro(product.priceCents)} per stuk</div>
              </div>
              <div className="qty-ctrl">
                <button onClick={() => changeQty(line.productId, -1)}>−</button>
                <span>{line.qty}</span>
                <button onClick={() => changeQty(line.productId, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="sum">
          <div className="sum-row">
            <span>Subtotaal</span>
            <span className="amount">{formatEuro(subtotal)}</span>
          </div>
          <div className="sum-row">
            <span>
              <button className="discount-btn" onClick={() => (discount ? setDiscount(null) : setShowDiscount(true))}>
                {discount ? 'Korting verwijderen' : 'Korting toevoegen'}
              </button>
            </span>
            <span className="amount">− {formatEuro(discountCents)}</span>
          </div>
          <div className="sum-row total">
            <span>Totaal</span>
            <span className="amount">{formatEuro(total)}</span>
          </div>
          {credit && (
            <div className="sum-row credit-row">
              <span>{credit.label}</span>
              <span className="amount">− {formatEuro(creditCents)}</span>
            </div>
          )}
          {credit && (
            <div className="sum-row total">
              <span>Bij te betalen</span>
              <span className="amount">{formatEuro(cents(Math.max(0, amountDue)))}</span>
            </div>
          )}
          {credit && amountDue < 0 && (
            <p className="error-text">Voeg nog voor {formatEuro(cents(-amountDue))} aan producten toe om het tegoed te verzilveren.</p>
          )}
        </div>
        <div className="pay">
          <button className="main" disabled={!canPay || checkout.isPending} onClick={() => finalizeSale('pin', null)}>
            Pin
          </button>
          <button disabled={!canPay || checkout.isPending} onClick={() => setShowCash(true)}>
            Contant
          </button>
          <button disabled={!canPay || checkout.isPending} onClick={() => finalizeSale('qr', null)}>
            QR
          </button>
        </div>
      </div>

      {variantGroup && (
        <VariantPickerModal
          group={variantGroup}
          onPick={(productId) => addLine(productId)}
          onClose={() => setVariantGroup(null)}
        />
      )}

      {showDiscount && (
        <DiscountModal
          current={discount}
          onApply={(d) => {
            setDiscount(d)
            setShowDiscount(false)
          }}
          onRemove={() => setDiscount(null)}
          onClose={() => setShowDiscount(false)}
        />
      )}

      {showCash && (
        <CashPaymentModal
          amountDue={cents(Math.max(0, amountDue))}
          onClose={() => setShowCash(false)}
          onConfirm={(received) => finalizeSale('cash', received)}
        />
      )}

      {showReturn && activeRegister && (
        <ReturnFlow
          registerId={activeRegister.id}
          products={products}
          onClose={() => setShowReturn(false)}
          onCreditIssued={(c) => {
            setCredit(c)
            setShowReturn(false)
          }}
        />
      )}
    </div>
  )
}
