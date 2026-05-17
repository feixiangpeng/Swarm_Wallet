import type { Verdict as VerdictType } from "../../src/coordinator"

export default function Verdict({ verdict }: { verdict: VerdictType }) {
  const time = new Date().toLocaleTimeString("en-US", { hour12: false })

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
