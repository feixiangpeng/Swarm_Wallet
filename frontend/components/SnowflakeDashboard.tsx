"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import SemanticMemoryGraph from "./SemanticMemoryGraph"

export interface DashboardData {
  summary: {
    searches: number
    priced_findings: number
    products_tracked: number
    searches_embedded: number
  }
  semantic_enabled: boolean
  semantic_memory: {
    model: string
    similarity_threshold: number
    findings_embedded: number
    embedded_queries: Array<{
      query_text: string
      finding_count: number | null
      completed_at: string | null
    }>
    similar_pairs: Array<{
      query_a: string
      query_b: string
      similarity: number
    }>
  } | null
  recent_searches: Array<{
    query_text: string
    status: string
    finding_count: number | null
    duration_ms: number | null
    completed_at: string | null
    has_embedding: boolean
  }>
  site_reliability: Array<{
    site: string
    role: string
    success_pct: number
    sample_size: number
  }>
  price_history: Array<{
    product_key: string
    observation_count: number
    min_price_90d: number | null
    avg_price_90d: number | null
    max_price_90d: number | null
    days_of_history: number
  }>
  daily_prices: Array<{
    product_key: string
    site: string
    price_day: string
    min_price: number
    avg_price: number
    observation_count: number
  }>
  outliers: Array<{
    product_key: string
    site: string
    price: number
    outlier_reason: string | null
    recorded_at: string
  }>
}

function fmtTime(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return iso
  }
}

function fmtMs(ms: number | null) {
  if (ms == null) return "—"
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function fmtMoney(n: number | null) {
  if (n == null) return "—"
  return `$${n.toFixed(0)}`
}

export default function SnowflakeDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/snowflake/dashboard", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
        setData(null)
        return
      }
      setError(null)
      setData(json as DashboardData)
    } catch (err) {
      setError(String(err))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 12_000)
    return () => clearInterval(id)
  }, [load])

  const maxSuccess = Math.max(
    1,
    ...(data?.site_reliability.map((r) => r.success_pct) ?? [100])
  )

  return (
    <div className="memory-root">
      <header className="memory-header">
        <div className="memory-header-left">
          <Link href="/" className="memory-back">
            ← swarm.wallet
          </Link>
          <h1 className="memory-title">
            swarm<span>.</span>memory
          </h1>
          <p className="memory-subtitle">
            Snowflake warehouse — price history, site reliability, collective intelligence ·{" "}
            <Link href="/architecture" className="memory-inline-link">
              system architecture →
            </Link>
          </p>
        </div>
        <button type="button" className="memory-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? "loading…" : "refresh"}
        </button>
      </header>

      {error && (
        <div className="memory-error">
          <p>{error}</p>
          <p className="memory-error-hint">
            Ensure Snowflake vars are in <code>.env</code>, run{" "}
            <code>npm run snowflake:migrate</code>, and start the backend with{" "}
            <code>npm run server</code>.
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="memory-metrics">
            <div className="memory-metric">
              <span className="memory-metric-num">{data.summary.searches}</span>
              <span className="memory-metric-label">total swarms</span>
            </div>
            <div className="memory-metric-divider" />
            <div className="memory-metric">
              <span className="memory-metric-num">{data.summary.priced_findings}</span>
              <span className="memory-metric-label">priced findings</span>
            </div>
            <div className="memory-metric-divider" />
            <div className="memory-metric">
              <span className="memory-metric-num">{data.summary.products_tracked}</span>
              <span className="memory-metric-label">products tracked</span>
            </div>
            {data.semantic_enabled && (
              <>
                <div className="memory-metric-divider" />
                <div className="memory-metric">
                  <span className="memory-metric-num">{data.summary.searches_embedded}</span>
                  <span className="memory-metric-label">semantic embeddings</span>
                </div>
              </>
            )}
          </div>

          {data.semantic_enabled && data.semantic_memory && (
            <SemanticMemoryGraph data={data.semantic_memory} />
          )}

          <section className="memory-section">
            <h2 className="memory-section-title">Recent swarms</h2>
            <div className="memory-table-wrap">
              <table className="memory-table">
                <thead>
                  <tr>
                    <th>query</th>
                    <th>status</th>
                    {data.semantic_enabled && <th>vector</th>}
                    <th>findings</th>
                    <th>duration</th>
                    <th>completed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_searches.length === 0 ? (
                    <tr>
                      <td colSpan={data.semantic_enabled ? 6 : 5} className="memory-empty">
                        No swarms yet — run a search on the home page.
                      </td>
                    </tr>
                  ) : (
                    data.recent_searches.map((row, i) => (
                      <tr key={`${row.query_text}-${i}`}>
                        <td className="memory-cell-query">{row.query_text}</td>
                        <td>
                          <span className={`memory-badge status-${row.status}`}>{row.status}</span>
                        </td>
                        {data.semantic_enabled && (
                          <td>
                            {row.has_embedding ? (
                              <span className="memory-badge memory-badge-vector">768d</span>
                            ) : (
                              <span className="memory-cell-dim">—</span>
                            )}
                          </td>
                        )}
                        <td>{row.finding_count ?? "—"}</td>
                        <td>{fmtMs(row.duration_ms)}</td>
                        <td className="memory-cell-dim">{fmtTime(row.completed_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="memory-grid">
            <section className="memory-section">
              <h2 className="memory-section-title">Site reliability (30d)</h2>
              {data.site_reliability.length === 0 ? (
                <p className="memory-empty-block">
                  Run more swarms — need 3+ agent events per site.
                </p>
              ) : (
                <ul className="memory-bars">
                  {data.site_reliability.map((r) => (
                    <li key={`${r.site}-${r.role}`} className="memory-bar-row">
                      <span className="memory-bar-label">
                        {r.site}
                        <span className="memory-bar-role">{r.role}</span>
                      </span>
                      <div className="memory-bar-track">
                        <span
                          className="memory-bar-fill"
                          style={{ width: `${(r.success_pct / maxSuccess) * 100}%` }}
                        />
                      </div>
                      <span className="memory-bar-value">{r.success_pct}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="memory-section">
              <h2 className="memory-section-title">Price history (90d)</h2>
              {data.price_history.length === 0 ? (
                <p className="memory-empty-block">No price history yet.</p>
              ) : (
                <div className="memory-table-wrap">
                  <table className="memory-table memory-table-compact">
                    <thead>
                      <tr>
                        <th>product</th>
                        <th>obs</th>
                        <th>low</th>
                        <th>avg</th>
                        <th>high</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.price_history.map((r) => (
                        <tr key={r.product_key}>
                          <td className="memory-cell-query">{r.product_key}</td>
                          <td>{r.observation_count}</td>
                          <td>{fmtMoney(r.min_price_90d)}</td>
                          <td className="memory-cell-green">{fmtMoney(r.avg_price_90d)}</td>
                          <td>{fmtMoney(r.max_price_90d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="memory-section">
            <h2 className="memory-section-title">Daily rollups (dynamic table)</h2>
            {data.daily_prices.length === 0 ? (
              <p className="memory-empty-block">
                PRODUCT_PRICE_DAILY fills after findings land (~1h refresh lag).
              </p>
            ) : (
              <div className="memory-table-wrap">
                <table className="memory-table memory-table-compact">
                  <thead>
                    <tr>
                      <th>product</th>
                      <th>site</th>
                      <th>day</th>
                      <th>min</th>
                      <th>avg</th>
                      <th>n</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily_prices.map((r, i) => (
                      <tr key={`${r.product_key}-${r.site}-${i}`}>
                        <td className="memory-cell-query">{r.product_key}</td>
                        <td>{r.site}</td>
                        <td className="memory-cell-dim">{r.price_day.slice(0, 10)}</td>
                        <td>{fmtMoney(r.min_price)}</td>
                        <td>{fmtMoney(r.avg_price)}</td>
                        <td>{r.observation_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="memory-section">
            <h2 className="memory-section-title">Outlier flags</h2>
            {data.outliers.length === 0 ? (
              <p className="memory-empty-block">No outliers flagged yet.</p>
            ) : (
              <div className="memory-table-wrap">
                <table className="memory-table memory-table-compact">
                  <thead>
                    <tr>
                      <th>product</th>
                      <th>site</th>
                      <th>price</th>
                      <th>reason</th>
                      <th>when</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outliers.map((r, i) => (
                      <tr key={`${r.product_key}-${i}`}>
                        <td className="memory-cell-query">{r.product_key}</td>
                        <td>{r.site}</td>
                        <td className="memory-cell-amber">${r.price.toFixed(0)}</td>
                        <td>{r.outlier_reason ?? "—"}</td>
                        <td className="memory-cell-dim">{fmtTime(r.recorded_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
