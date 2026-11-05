import { useState } from 'react'
import * as XLSX from 'xlsx'
import { formatEuro } from '../../../shared/money/money'
import type { Product } from '../../../shared/lib/product'
import {
  buildImportPlan,
  detectColumnMapping,
  type ExistingProduct,
  type ImportMode,
  parseImportRows,
} from '../lib/excelImport'

interface Props {
  products: Product[]
  onClose: () => void
  onConfirm: (plan: ReturnType<typeof buildImportPlan>, filename: string) => void
}

export function ImportWizard({ products, onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<ImportMode>('add')
  const [preview, setPreview] = useState<ReturnType<typeof analyze> | null>(null)
  const [filename, setFilename] = useState('')

  function analyze(headers: string[], rows: unknown[][]) {
    const mapping = detectColumnMapping(headers)
    const existingBySku = new Map<string, ExistingProduct>(
      products.map((p) => [p.sku.toLowerCase(), { id: p.id, sku: p.sku, stock: p.stock }]),
    )
    const { parsed, errors } = parseImportRows(rows, mapping, existingBySku)
    return { mapping, parsed, errors }
  }

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
    const [headerRow, ...dataRows] = rows
    setFilename(file.name)
    setPreview(analyze((headerRow as string[]) ?? [], dataRows))
  }

  const plan = preview ? buildImportPlan(preview.parsed, mode) : null

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Excel importeren</h2>

        {!preview && (
          <>
            <p>Kies een .xlsx, .xls of .csv bestand met dezelfde kolommen als het sjabloon.</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
          </>
        )}

        {preview && plan && (
          <>
            <div className="import-summary">
              <div>
                <strong>{plan.newProducts.length}</strong> nieuw
              </div>
              <div>
                <strong>{plan.updatedProducts.length}</strong> bij te werken
              </div>
              <div>
                <strong>{preview.errors.length}</strong> overgeslagen
              </div>
            </div>

            <div className="seg">
              <button aria-pressed={mode === 'add'} onClick={() => setMode('add')}>
                Optellen bij bestaande voorraad
              </button>
              <button aria-pressed={mode === 'overwrite'} onClick={() => setMode('overwrite')}>
                Overschrijven
              </button>
            </div>

            {preview.errors.length > 0 && (
              <details>
                <summary>Overgeslagen rijen ({preview.errors.length})</summary>
                <ul>
                  {preview.errors.map((e) => (
                    <li key={e.rowNumber}>
                      Rij {e.rowNumber}: {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <table className="preview-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Naam</th>
                  <th>Prijs</th>
                  <th>Voorraad</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.parsed.map((row) => (
                  <tr key={row.sku}>
                    <td>{row.sku}</td>
                    <td>
                      {row.name}
                      {row.variant ? ` · ${row.variant}` : ''}
                    </td>
                    <td>{formatEuro(row.priceCents)}</td>
                    <td>{row.stock}</td>
                    <td>{row.existing ? 'Bijgewerkt' : 'Nieuw'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="modal-foot">
          <button onClick={onClose}>Annuleren</button>
          {plan && (
            <button className="accent" onClick={() => onConfirm(plan, filename)}>
              Importeren
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
