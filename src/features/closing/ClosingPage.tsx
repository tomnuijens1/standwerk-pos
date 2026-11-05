import { useState } from 'react'
import { useCurrentEvent } from '../../app/EventGate'
import { cents, formatEuro, parseEuroInputToCents } from '../../shared/money/money'
import { useRegisters } from '../../shared/supabase/useEvent'
import { fetchClosingSummary, saveClosing, useClosingSummary } from './api/closingData'
import './closing.css'

const METHOD_LABELS: Record<string, string> = { pin: 'Pin', cash: 'Contant', qr: 'QR', exchange: 'Omruilen (uitgegeven)', omruil: 'Omruiltegoed (verzilverd)' }

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ClosingPage() {
  const event = useCurrentEvent()
  const { data: registers = [] } = useRegisters(event.id)

  const [registerId, setRegisterId] = useState<string | null>(null)
  const [date, setDate] = useState(todayKey())
  const [openingFloatInput, setOpeningFloatInput] = useState(formatEuro(cents(event.opening_float_cents)))
  const [countedInput, setCountedInput] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: summary, isLoading } = useClosingSummary(event.id, registerId, date)

  let openingFloatCents = cents(0)
  try {
    openingFloatCents = parseEuroInputToCents(openingFloatInput)
  } catch {
    /* toont fout via render hieronder */
  }

  const expectedCents = summary ? cents(openingFloatCents + summary.cashInCents - summary.cashOutCents) : cents(0)

  let countedCents: number | null = null
  try {
    countedCents = countedInput === '' ? null : parseEuroInputToCents(countedInput)
  } catch {
    countedCents = null
  }

  const diffCents = countedCents !== null ? cents(countedCents - expectedCents) : null

  async function handleSave() {
    if (countedCents === null || !summary) {
      window.alert('Vul het getelde contante geld in')
      return
    }
    setSaving(true)
    try {
      await saveClosing({
        eventId: event.id,
        registerId,
        date,
        openingFloatCents,
        expectedCents,
        countedCents,
        diffCents: cents(countedCents - expectedCents),
        summary,
        note,
      })
      window.alert('Dagafsluiting opgeslagen')
      setCountedInput('')
      setNote('')
    } catch (e) {
      window.alert(`Opslaan mislukt: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    const XLSX = await import('xlsx')
    const data = summary ?? (await fetchClosingSummary(event.id, registerId, date))
    const registerLabel = registerId ? (registers.find((r) => r.id === registerId)?.name ?? '') : 'Alle kassa’s'

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Datum', date],
      ['Kassa', registerLabel],
      ['Bonnen', data.txCount],
      ['Netto omzet', data.netCents / 100],
      ['Bruto omzet', data.grossCents / 100],
      ['Retouren', data.refundsCents / 100],
      ['Korting', data.discountCents / 100],
      ['Btw', data.vatCents / 100],
      ['Items netto', data.itemsCount],
      ['Wisselgeld bij opening', openingFloatCents / 100],
      ['Verwacht contant', expectedCents / 100],
      ['Geteld', countedCents !== null ? countedCents / 100 : ''],
      ['Verschil', diffCents !== null ? diffCents / 100 : ''],
      ['Notitie', note],
    ])
    const methodsSheet = XLSX.utils.json_to_sheet(
      data.methods.map((m) => ({ Betaalmethode: METHOD_LABELS[m.method] ?? m.method, Ontvangen: m.inCents / 100, Terugbetaald: m.outCents / 100, Netto: m.netCents / 100 })),
    )

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Afsluiting')
    XLSX.utils.book_append_sheet(workbook, methodsSheet, 'Betaalmethodes')
    XLSX.writeFile(workbook, `dagafsluiting-${date}.xlsx`)
  }

  return (
    <div className="closing-page">
      <h1>Dagafsluiting</h1>

      <div className="closing-filters">
        <label>
          Kassa
          <select value={registerId ?? 'all'} onChange={(e) => setRegisterId(e.target.value === 'all' ? null : e.target.value)}>
            <option value="all">Alle kassa&apos;s</option>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Datum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {isLoading || !summary ? (
        <div className="auth-gate-loading">Laden…</div>
      ) : (
        <>
          <div className="closing-grid">
            <div className="closing-stat">
              <b>{summary.txCount}</b>
              <span>Bonnen</span>
            </div>
            <div className="closing-stat">
              <b>{formatEuro(summary.netCents)}</b>
              <span>Netto omzet</span>
            </div>
            <div className="closing-stat">
              <b>{formatEuro(summary.refundsCents)}</b>
              <span>Retouren</span>
            </div>
            <div className="closing-stat">
              <b>{formatEuro(summary.discountCents)}</b>
              <span>Korting</span>
            </div>
            <div className="closing-stat">
              <b>{summary.itemsCount}</b>
              <span>Items netto</span>
            </div>
            <div className="closing-stat">
              <b>{formatEuro(summary.vatCents)}</b>
              <span>Btw</span>
            </div>
          </div>

          <table className="inv-table">
            <thead>
              <tr>
                <th>Betaalmethode</th>
                <th>Ontvangen</th>
                <th>Terugbetaald</th>
                <th>Netto</th>
              </tr>
            </thead>
            <tbody>
              {summary.methods.length === 0 && (
                <tr>
                  <td colSpan={4} className="tx-empty">
                    Geen transacties op deze dag.
                  </td>
                </tr>
              )}
              {summary.methods.map((m) => (
                <tr key={m.method}>
                  <td>{METHOD_LABELS[m.method] ?? m.method}</td>
                  <td>{formatEuro(m.inCents)}</td>
                  <td>{m.outCents > 0 ? `− ${formatEuro(m.outCents)}` : '—'}</td>
                  <td>
                    <b>{formatEuro(m.netCents)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="closing-count">
            <label>
              Wisselgeld bij opening
              <input value={openingFloatInput} onChange={(e) => setOpeningFloatInput(e.target.value)} />
            </label>
            <label>
              Geteld contant geld
              <input value={countedInput} onChange={(e) => setCountedInput(e.target.value)} placeholder="bijv. 185,50" />
            </label>
          </div>

          <div className="sum">
            <div className="sum-row">
              <span>Verwacht contant in de la</span>
              <span className="amount">{formatEuro(expectedCents)}</span>
            </div>
            <div className="sum-row total">
              <span>Verschil</span>
              <span className={`amount ${diffCents !== null && diffCents !== 0 ? 'diff-bad' : 'diff-ok'}`}>
                {diffCents === null ? '—' : diffCents === 0 ? formatEuro(cents(0)) : diffCents > 0 ? `+ ${formatEuro(diffCents)}` : `− ${formatEuro(cents(-diffCents))}`}
              </span>
            </div>
          </div>

          <label>
            Notitie
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optioneel, bijv. wie geteld heeft" />
          </label>

          <div className="modal-foot">
            <button onClick={() => void handleExport()}>Exporteren</button>
            <button className="accent" disabled={saving} onClick={() => void handleSave()}>
              Afsluiting opslaan
            </button>
          </div>
        </>
      )}
    </div>
  )
}
