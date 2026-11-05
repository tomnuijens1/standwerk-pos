import { formatEuro } from '../../../shared/money/money'
import type { ProductGroup } from '../lib/groupProducts'

interface Props {
  group: ProductGroup
  onPick: (productId: string) => void
  onClose: () => void
}

export function VariantPickerModal({ group, onPick, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{group.name}</h2>
        <p className="amount-due">{formatEuro(group.priceCents)}</p>
        <div className="variant-grid">
          {group.items.map((p) => (
            <button
              key={p.id}
              className="variant-btn"
              disabled={p.stock === 0}
              onClick={() => {
                onPick(p.id)
                onClose()
              }}
            >
              <span className="variant-label">{p.variant || '—'}</span>
              <span className="variant-stock">{p.stock === 0 ? 'Uitverkocht' : `${p.stock} op voorraad`}</span>
            </button>
          ))}
        </div>
        <div className="modal-foot">
          <button onClick={onClose}>Annuleren</button>
        </div>
      </div>
    </div>
  )
}
