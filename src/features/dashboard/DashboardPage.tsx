import { useState } from 'react'
import { Bar, Chart as ChartJS, Doughnut } from 'react-chartjs-2'
import { useCurrentEvent } from '../../app/EventGate'
import { cents, formatEuro } from '../../shared/money/money'
import './components/charts'
import { exportDashboardToExcel } from './lib/excelExport'
import { compare } from './lib/compare'
import type { DashboardRange } from './lib/period'
import { useDashboard } from './useDashboard'
import './dashboard.css'

const RANGE_LABELS: Record<DashboardRange, string> = { today: 'Vandaag', '7d': '7 dagen', all: 'Alles' }
const METHOD_LABELS: Record<string, string> = { pin: 'Pin', cash: 'Contant', qr: 'QR' }

function Trend({ comparison }: { comparison: ReturnType<typeof compare> }) {
  if (!comparison) return null
  const symbol = comparison.direction === 'up' ? '▲' : comparison.direction === 'down' ? '▼' : '—'
  return (
    <span className={`trend trend-${comparison.direction}`}>
      {symbol} {Math.abs(comparison.percent)}%
    </span>
  )
}

export function DashboardPage() {
  const event = useCurrentEvent()
  const [range, setRange] = useState<DashboardRange>('today')
  const d = useDashboard(event.id, range)

  const categoryColors = ['#FFC23D', '#8C86FF', '#5ED3A4', '#FF8A7A', '#6EC6FF', '#F49AD8', '#C7D36B', '#FFB27A']

  return (
    <div className="dashboard-page">
      <div className="dash-head">
        <h1>Dashboard</h1>
        <div className="seg">
          {(['today', '7d', 'all'] as DashboardRange[]).map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {d.isLoading ? (
        <div className="auth-gate-loading">Laden…</div>
      ) : (
        <>
          <div className="hero-card">
            <span className="hero-label">Netto omzet · {RANGE_LABELS[range]}</span>
            <span className="hero-amount">{formatEuro(d.stats.netCents)}</span>
            <Trend comparison={compare(d.stats.netCents, d.previousStats?.netCents ?? null)} />
            {d.stats.marginCents !== null && <span className="hero-sub">Brutomarge: {formatEuro(d.stats.marginCents)}</span>}
          </div>

          <div className="kpi-grid">
            <div className="kpi">
              <b>{d.stats.txCount}</b>
              <span>Transacties</span>
            </div>
            <div className="kpi">
              <b>{formatEuro(d.stats.avgSaleCents)}</b>
              <span>Gemiddelde bon</span>
            </div>
            <div className="kpi">
              <b>{d.stats.itemsCount}</b>
              <span>Items verkocht (netto)</span>
            </div>
            <div className="kpi">
              <b>{formatEuro(d.stats.refundsCents)}</b>
              <span>
                Retouren ({d.stats.refundsCount}, {d.stats.refundedItems} items)
              </span>
            </div>
            <div className="kpi">
              <b>{formatEuro(d.stats.discountCents)}</b>
              <span>Korting ({d.stats.discountPercentOfGross.toFixed(1)}% van bruto)</span>
            </div>
            <div className="kpi">
              <b>{d.lowStock.length}</b>
              <span>Producten bijna op/uitverkocht</span>
            </div>
          </div>

          <div className="dash-grid">
            <div className="dash-card dash-wide">
              <h2>Omzetverloop</h2>
              <div className="chart-box">
                <ChartJS
                  type="bar"
                  data={{
                    labels: d.revenueSeries.map((b) => b.label),
                    datasets: [
                      { type: 'bar' as const, label: RANGE_LABELS[range], data: d.revenueSeries.map((b) => b.currentCents / 100), backgroundColor: '#4F46E5', borderRadius: 4 },
                      ...(d.bounds.prevFrom !== null
                        ? [
                            {
                              type: 'line' as const,
                              label: d.bounds.previousLabel,
                              data: d.revenueSeries.map((b) => (b.previousCents ?? 0) / 100),
                              borderColor: '#9C9DB4',
                              borderDash: [4, 4],
                              pointRadius: 0,
                            },
                          ]
                        : []),
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: d.bounds.prevFrom !== null } } }}
                />
              </div>
            </div>

            <div className="dash-card">
              <h2>Per categorie</h2>
              {d.byCategory.length === 0 ? (
                <p className="tx-empty">Geen verkopen.</p>
              ) : (
                <div className="chart-box">
                  <Doughnut
                    data={{
                      labels: d.byCategory.map((c) => c.category),
                      datasets: [{ data: d.byCategory.map((c) => c.netCents / 100), backgroundColor: categoryColors }],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>
              )}
            </div>

            <div className="dash-card">
              <h2>Bestsellers</h2>
              <ol className="rank-list">
                {d.bestsellers.map((b) => (
                  <li key={`${b.name}-${b.category}`}>
                    <span>{b.name}</span>
                    <b>{formatEuro(b.netCents)}</b>
                  </li>
                ))}
                {d.bestsellers.length === 0 && <li className="tx-empty">Geen verkopen.</li>}
              </ol>
            </div>

            <div className="dash-card">
              <h2>Kassa&apos;s</h2>
              <ol className="rank-list">
                {d.byRegister.map((r) => (
                  <li key={r.register}>
                    <span>{r.register}</span>
                    <b>{formatEuro(r.netCents)}</b>
                  </li>
                ))}
              </ol>
              <h2 className="dash-subheading">Betaalmethodes</h2>
              <div className="method-bars">
                {d.byMethod.map((m) => {
                  const max = Math.max(...d.byMethod.map((x) => x.netCents), 1)
                  return (
                    <div key={m.method} className="method-bar-row">
                      <span>{METHOD_LABELS[m.method] ?? m.method}</span>
                      <div className="method-bar-track">
                        <div className="method-bar-fill" style={{ width: `${Math.max(0, (m.netCents / max) * 100)}%` }} />
                      </div>
                      <b>{formatEuro(m.netCents)}</b>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="dash-card">
              <h2>Bijna op</h2>
              <ol className="rank-list">
                {d.lowStock.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.name}
                      {p.variant ? ` · ${p.variant}` : ''}
                    </span>
                    <b className={p.stock === 0 ? 'rank-bad' : 'rank-warn'}>{p.stock === 0 ? 'Uitverkocht' : `${p.stock} over`}</b>
                  </li>
                ))}
                {d.lowStock.length === 0 && <li className="tx-empty">Alles ruim op voorraad.</li>}
              </ol>
            </div>

            <div className="dash-card">
              <h2>Verkoop per maat</h2>
              {d.bySize.length === 0 ? (
                <p className="tx-empty">Geen maatgegevens.</p>
              ) : (
                <div className="chart-box">
                  <Bar
                    data={{ labels: d.bySize.map((s) => s.variant), datasets: [{ data: d.bySize.map((s) => s.qty), backgroundColor: '#FFC23D', borderRadius: 4 }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                  />
                </div>
              )}
            </div>

            <div className="dash-card">
              <h2>Voorraadprognose</h2>
              <ol className="rank-list">
                {d.stockForecast.slice(0, 8).map((f) => (
                  <li key={f.productId}>
                    <span>
                      {f.name}
                      {f.variant ? ` · ${f.variant}` : ''}
                    </span>
                    <b className={f.daysLeft < 2 ? 'rank-bad' : f.daysLeft < 5 ? 'rank-warn' : ''}>
                      {Number.isFinite(f.daysLeft) ? `${f.daysLeft.toFixed(1)} dagen` : '—'}
                    </b>
                  </li>
                ))}
                {d.stockForecast.length === 0 && <li className="tx-empty">Nog geen verkooptempo bekend.</li>}
              </ol>
            </div>

            <div className="dash-card dash-wide">
              <h2>Laatste bonnen</h2>
              <table className="inv-table">
                <tbody>
                  {d.recentReceipts.map((r) => (
                    <tr key={r.id} className={r.kind === 'refund' ? 'recent-refund' : ''}>
                      <td>
                        {r.kind === 'refund' ? 'RET' : r.registerCode}-{r.receiptNumber}
                      </td>
                      <td>{new Date(r.createdAt).toLocaleString('nl-NL')}</td>
                      <td>{r.registerName}</td>
                      <td>{r.kind === 'refund' ? `− ${formatEuro(cents(r.totalCents))}` : formatEuro(cents(r.totalCents))}</td>
                    </tr>
                  ))}
                  {d.recentReceipts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="tx-empty">
                        Nog geen bonnen.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modal-foot">
            <button className="accent" onClick={() => void exportDashboardToExcel(d, range, RANGE_LABELS[range])}>
              Exporteren naar Excel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
