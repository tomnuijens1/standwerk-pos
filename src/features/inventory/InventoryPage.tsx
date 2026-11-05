import { useMemo, useState } from 'react'
import { useCurrentEvent } from '../../app/EventGate'
import { formatEuro } from '../../shared/money/money'
import type { Product } from '../../shared/lib/product'
import { useCategories } from '../../shared/supabase/useEvent'
import { useProducts } from '../pos/api/products'
import { useImportPlan } from './api/products'
import { ImportWizard } from './components/ImportWizard'
import { StockAdjustModal } from './components/StockAdjustModal'
import { StockMovementsLog } from './components/StockMovementsLog'
import { exportInventoryToExcel } from './lib/excelExport'
import './inventory.css'

export function InventoryPage() {
  const event = useCurrentEvent()
  const { data: products = [], isLoading } = useProducts(event.id)
  const { data: categories = [] } = useCategories(event.id)
  const [tab, setTab] = useState<'products' | 'movements'>('products')
  const [showImport, setShowImport] = useState(false)
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [query, setQuery] = useState('')

  const categoryIdByName = useMemo(() => new Map(categories.map((c) => [c.name.toLowerCase(), c.id])), [categories])
  const importPlan = useImportPlan(event.id, categoryIdByName)

  const visible = products.filter((p) => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query.toLowerCase()))

  if (isLoading) return <div className="auth-gate-loading">Voorraad laden…</div>

  return (
    <div>
      <h1>Voorraad</h1>
      <div className="inv-tabs">
        <button aria-pressed={tab === 'products'} onClick={() => setTab('products')}>
          Producten
        </button>
        <button aria-pressed={tab === 'movements'} onClick={() => setTab('movements')}>
          Voorraadmutaties
        </button>
      </div>

      {tab === 'products' ? (
        <>
          <div className="inv-head">
            <div className="inv-actions">
              <input placeholder="Zoeken…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button onClick={() => setShowImport(true)}>Excel importeren</button>
              <button onClick={() => exportInventoryToExcel(products)}>Excel exporteren</button>
            </div>
          </div>

          <table className="inv-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Naam</th>
                <th>Categorie</th>
                <th>Prijs</th>
                <th>Voorraad</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>{p.sku}</td>
                  <td>
                    {p.name}
                    {p.variant ? ` · ${p.variant}` : ''}
                  </td>
                  <td>{p.category}</td>
                  <td>{formatEuro(p.priceCents)}</td>
                  <td>{p.stock}</td>
                  <td>
                    {p.stock === 0 ? (
                      <span className="badge bad">Uitverkocht</span>
                    ) : p.minStock !== null && p.stock <= p.minStock ? (
                      <span className="badge warn">Bijna op</span>
                    ) : (
                      <span className="badge ok">Op voorraad</span>
                    )}
                  </td>
                  <td>
                    <button onClick={() => setAdjustProduct(p)}>Voorraad aanpassen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <StockMovementsLog eventId={event.id} />
      )}

      {showImport && (
        <ImportWizard
          products={products}
          onClose={() => setShowImport(false)}
          onConfirm={(plan, filename) => {
            importPlan.mutate(
              { plan, filename },
              {
                onSuccess: () => setShowImport(false),
                onError: (e: Error) => window.alert(`Importeren mislukt: ${e.message}`),
              },
            )
          }}
        />
      )}

      {adjustProduct && <StockAdjustModal eventId={event.id} product={adjustProduct} onClose={() => setAdjustProduct(null)} />}
    </div>
  )
}
