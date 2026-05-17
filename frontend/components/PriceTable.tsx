"use client"

import { useState } from "react"
import type { AgentState } from "@/hooks/useSwarm"

type SortKey = "price" | "site" | "confidence"

export default function PriceTable({ agents }: { agents: AgentState[] }) {
  const [sort, setSort] = useState<SortKey>("price")

  const rows = agents
    .filter(a => a.finding != null)
    .map(a => ({
      site:       a.site.replace("www.", ""),
      role:       a.role,
      price:      a.finding?.price ?? null,
      name:       a.finding?.name ?? "—",
      highlight:  a.finding?.highlight ?? "",
      confidence: a.finding?.confidence ?? null,
      url:        a.finding?.url ?? null,
      status:     a.status,
    }))
    .sort((a, b) => {
      if (sort === "price") {
        if (a.price == null) return 1
        if (b.price == null) return -1
        return a.price - b.price
      }
      if (sort === "confidence") {
        return (b.confidence ?? 0) - (a.confidence ?? 0)
      }
      return a.site.localeCompare(b.site)
    })

  if (rows.length === 0) return null

  const bestPrice = rows.filter(r => r.price != null).sort((a, b) => (a.price ?? 999) - (b.price ?? 999))[0]?.price

  return (
    <div className="price-table-wrap">
      <div className="price-table-header">
        <span className="price-table-title">all findings</span>
        <div className="price-table-sort">
          <span>sort by</span>
          {(["price","confidence","site"] as SortKey[]).map(k => (
            <button
              key={k}
              className={`price-table-sort-btn${sort === k ? " active" : ""}`}
              onClick={() => setSort(k)}
            >{k}</button>
          ))}
        </div>
      </div>

      <div className="price-table">
        <div className="price-table-thead">
          <div className="ptc-site">site</div>
          <div className="ptc-name">result</div>
          <div className="ptc-price">price</div>
          <div className="ptc-conf">confidence</div>
        </div>

        {rows.map((row, i) => {
          const isBest = row.price != null && row.price === bestPrice
          return (
            <div
              key={`${row.site}-${i}`}
              className={`price-table-row${isBest ? " best" : ""}`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="ptc-site">
                {isBest && <span className="ptc-best-badge">best</span>}
                <span className="ptc-site-name">{row.site}</span>
                <span className="ptc-role">{row.role}</span>
              </div>
              <div className="ptc-name">
                <div className="ptc-product-name">{row.name}</div>
                {row.highlight && <div className="ptc-highlight">{row.highlight}</div>}
              </div>
              <div className="ptc-price">
                {row.price != null
                  ? <span className="ptc-price-val" style={{ color: isBest ? "var(--green)" : undefined }}>${row.price}</span>
                  : <span className="ptc-no-price">—</span>
                }
              </div>
              <div className="ptc-conf">
                {row.confidence != null && (
                  <div className="ptc-conf-bar-wrap">
                    <div
                      className="ptc-conf-bar"
                      style={{ width: `${Math.round(row.confidence * 100)}%` }}
                    />
                    <span className="ptc-conf-pct">{Math.round(row.confidence * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
