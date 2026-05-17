"use client"

import type { AgentState } from "@/hooks/useSwarm"

export default function PriceSpread({ agents }: { agents: AgentState[] }) {
  const priced = agents
    .filter(a => a.finding?.price != null)
    .map(a => ({ site: a.site.replace("www.", ""), price: a.finding!.price as number, status: a.status }))
    .sort((a, b) => a.price - b.price)

  if (priced.length < 2) return null

  const min = priced[0].price
  const max = priced[priced.length - 1].price
  const range = max - min || 1
  const best = priced[0]

  return (
    <div className="price-spread">
      <div className="price-spread-header">
        <span className="price-spread-label">price spread</span>
        <span className="price-spread-range">${min} – ${max}</span>
      </div>

      <div className="price-spread-track">
        {/* range fill */}
        <div
          className="price-spread-fill"
          style={{
            left: "0%",
            width: "100%",
          }}
        />
        {/* dots */}
        {priced.map((p, i) => {
          const pct = range === 0 ? 50 : ((p.price - min) / range) * 100
          return (
            <div
              key={p.site}
              className={`price-spread-dot${p.site === best.site ? " best" : ""}`}
              style={{ left: `${pct}%`, animationDelay: `${i * 0.07}s` }}
              title={`${p.site} · $${p.price}`}
            >
              <div className="price-spread-dot-label">
                <span className="psd-price">${p.price}</span>
                <span className="psd-site">{p.site}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="price-spread-footer">
        <span className="price-spread-best">
          ✦ best: <strong>{best.site}</strong> @ ${best.price}
        </span>
        <span className="price-spread-savings">
          {range > 0 && `save $${range} vs highest`}
        </span>
      </div>
    </div>
  )
}
