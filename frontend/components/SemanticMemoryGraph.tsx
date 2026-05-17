"use client"

import type { DashboardData } from "./SnowflakeDashboard"

type SemanticMemory = NonNullable<DashboardData["semantic_memory"]>

function truncate(s: string, max = 28) {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

function circleLayout(n: number, cx: number, cy: number, r: number) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
}

function itemKey(
  item: { search_id: string; query_text: string },
  index: number
): string {
  const id = item.search_id?.trim()
  return id || `embed-${index}-${item.query_text}`
}

function labelPlacement(x: number, y: number) {
  return {
    x,
    y: y + 26,
    anchor: "middle" as const,
  }
}

export default function SemanticMemoryGraph({
  data,
  onDelete,
  deletingId,
}: {
  data: SemanticMemory
  onDelete?: (searchId: string, queryText: string) => void
  deletingId?: string | null
}) {
  const items = data.embedded_queries
  const queryIndex = new Map(items.map((q, i) => [q.query_text, i]))
  const positions = circleLayout(items.length, 200, 160, 118)
  const thresholdPct = Math.round(data.similarity_threshold * 100)

  return (
    <section className="memory-section memory-semantic">
      <div className="memory-semantic-head">
        <h2 className="memory-section-title">Semantic vector memory</h2>
        <p className="memory-semantic-desc">
          Query embeddings live in Snowflake <code>SEARCHES.QUERY_EMBEDDING</code> (768-dim Cortex
          vectors). Lines show cosine similarity ≥ {thresholdPct}% — same links used for planner
          routing and verdict memory. Delete a swarm below to remove its vectors and rows.
        </p>
        <div className="memory-semantic-meta">
          <span className="memory-semantic-pill">{data.model}</span>
          <span className="memory-semantic-pill">
            {data.embedded_queries.length} query vectors
          </span>
          <span className="memory-semantic-pill">{data.findings_embedded} finding vectors</span>
          <span className="memory-semantic-pill">{data.similar_pairs.length} links</span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="memory-empty-block">
          No embeddings yet. Complete a swarm, then refresh — vectors are written after each run.
        </p>
      ) : (
        <div className="memory-semantic-body">
          <div className="memory-semantic-graph-wrap">
            <svg
              className="memory-semantic-graph"
              viewBox="0 0 400 320"
              role="img"
              aria-label="Similarity graph between embedded swarm queries"
            >
              <defs>
                <radialGradient id="memory-graph-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(59, 130, 246, 0.12)" />
                  <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                </radialGradient>
              </defs>
              <circle cx="200" cy="160" r="130" fill="url(#memory-graph-glow)" />
              {data.similar_pairs.map((pair) => {
                const i = queryIndex.get(pair.query_a)
                const j = queryIndex.get(pair.query_b)
                if (i == null || j == null) return null
                const a = positions[i]
                const b = positions[j]
                const opacity = 0.25 + pair.similarity * 0.65
                return (
                  <line
                    key={`${pair.query_a}-${pair.query_b}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className="memory-semantic-edge"
                    strokeWidth={1 + pair.similarity * 2}
                    opacity={opacity}
                  />
                )
              })}
              {items.map((item, i) => {
                const p = positions[i]
                const label = labelPlacement(p.x, p.y)
                return (
                  <g key={itemKey(item, i)} className="memory-semantic-node">
                    <circle cx={p.x} cy={p.y} r="14" className="memory-semantic-node-dot" />
                    <text
                      x={label.x}
                      y={label.y}
                      textAnchor={label.anchor}
                      className="memory-semantic-node-label"
                    >
                      {truncate(item.query_text, 18)}
                    </text>
                    <title>{item.query_text}</title>
                  </g>
                )
              })}
            </svg>
            <ul className="memory-semantic-legend">
              {items.map((item, i) => (
                <li
                  key={itemKey(item, i)}
                  className="memory-semantic-legend-item"
                  title={item.query_text}
                >
                  <span className="memory-semantic-legend-label">{truncate(item.query_text)}</span>
                  {onDelete && (
                    <button
                      type="button"
                      className="memory-delete-btn memory-delete-btn-compact"
                      disabled={!item.search_id?.trim() || deletingId === item.search_id}
                      onClick={() => onDelete(item.search_id, item.query_text)}
                    >
                      {deletingId === item.search_id ? "…" : "×"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="memory-semantic-links">
            <h3 className="memory-semantic-links-title">Similarity links</h3>
            {data.similar_pairs.length === 0 ? (
              <p className="memory-empty-block">
                {items.length < 2
                  ? "Need at least two embedded swarms to show links."
                  : `No pairs above ${thresholdPct}% yet — try rephrasing the same product.`}
              </p>
            ) : (
              <ul className="memory-semantic-pair-list">
                {data.similar_pairs.map((pair) => (
                  <li key={`${pair.query_a}-${pair.query_b}`} className="memory-semantic-pair">
                    <span className="memory-semantic-pair-a" title={pair.query_a}>
                      {truncate(pair.query_a, 22)}
                    </span>
                    <span className="memory-semantic-pair-bar-wrap">
                      <span
                        className="memory-semantic-pair-bar"
                        style={{ width: `${Math.round(pair.similarity * 100)}%` }}
                      />
                    </span>
                    <span className="memory-semantic-pair-pct">
                      {Math.round(pair.similarity * 100)}%
                    </span>
                    <span className="memory-semantic-pair-b" title={pair.query_b}>
                      {truncate(pair.query_b, 22)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
