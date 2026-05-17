import type { Verdict as VerdictType } from "../../src/coordinator"
import type { Finding } from "../../src/agent"

function confidenceScore(findings: Finding[]): number {
  if (findings.length === 0) return 0
  const avg = findings.reduce((sum, f) => sum + (f.confidence ?? 0.5), 0) / findings.length
  const coverage = Math.min(findings.length / 6, 1)
  return Math.round((avg * 0.7 + coverage * 0.3) * 100)
}

function ConfidenceMeter({ score }: { score: number }) {
  const label = score >= 85 ? "high" : score >= 60 ? "moderate" : "low"
  const color = score >= 85 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--red)"
  const bars = 10
  const filled = Math.round((score / 100) * bars)

  return (
    <div className="conf-meter">
      <div className="conf-meter-header">
        <span className="conf-meter-label">recommendation confidence</span>
        <span className="conf-meter-score" style={{ color }}>{score}% <span className="conf-meter-level">{label}</span></span>
      </div>
      <div className="conf-meter-bars">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className="conf-bar"
            style={{
              background: i < filled ? color : "var(--bg-elevated)",
              opacity: i < filled ? 1 - i * 0.04 : 1,
              animationDelay: `${i * 0.04}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Verdict({ verdict, findings = [] }: { verdict: VerdictType; findings?: Finding[] }) {
  const time  = new Date().toLocaleTimeString("en-US", { hour12: false })
  const score = confidenceScore(findings)
  const wh = verdict.warehouse_insights

  return (
    <div className="verdict">
      <div className="verdict-header">
        <span className="verdict-title">// intelligence report</span>
        <span className="verdict-timestamp">{time}</span>
      </div>

      <div className="verdict-body">
        <p className="verdict-recommendation">{verdict.recommendation}</p>

        <div className="verdict-section-label">top picks</div>
        <div className="verdict-picks">
          {verdict.top_picks.map(pick => (
            <div className="verdict-pick" key={pick.rank}>
              <div className="verdict-rank">{pick.rank}</div>
              <div className="verdict-pick-body">
                <div className="verdict-pick-name">{pick.name}</div>
                <div className="verdict-pick-meta">
                  <span className="verdict-pick-price">{pick.price}</span>
                  <span className="verdict-pick-source">@ {pick.source}</span>
                </div>
                <div className="verdict-pick-why">{pick.why}</div>
              </div>
            </div>
          ))}
        </div>

        {wh && (
          <div className="verdict-warehouse">
            <div className="verdict-section-label">snowflake memory</div>
            <p className="verdict-warehouse-signal">{wh.timing_signal}</p>
            {wh.collective_hint && (
              <p className="verdict-warehouse-hint">{wh.collective_hint}</p>
            )}
            {wh.price_history.observation_count > 0 && (
              <div className="verdict-warehouse-stats">
                <span>{wh.price_history.observation_count} obs (90d)</span>
                {wh.price_history.min_price_90d != null && (
                  <span>low ${wh.price_history.min_price_90d.toFixed(0)}</span>
                )}
                {wh.price_history.avg_price_90d != null && (
                  <span>avg ${wh.price_history.avg_price_90d.toFixed(0)}</span>
                )}
              </div>
            )}
            {wh.similar_searches && wh.similar_searches.length > 0 && (
              <ul className="verdict-similar">
                {wh.similar_searches.map((s) => (
                  <li key={s.query_text}>
                    <span className="verdict-similar-query">{s.query_text}</span>
                    <span className="verdict-similar-pct">
                      {Math.round(s.similarity * 100)}% match
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {wh.outliers.length > 0 && (
              <ul className="verdict-outliers">
                {wh.outliers.map((o) => (
                  <li key={`${o.site}-${o.price}`}>
                    <strong>{o.source}</strong> ${o.price} — {o.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="verdict-footer">
          <div className="verdict-aside caution">
            <div className="verdict-aside-label">⚠ caution</div>
            <div className="verdict-aside-text">{verdict.caution}</div>
          </div>
          <div className="verdict-aside timing">
            <div className="verdict-aside-label">◷ timing</div>
            <div className="verdict-aside-text">{verdict.timing}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
