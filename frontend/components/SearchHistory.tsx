"use client"

import { useState } from "react"
import type { HistoryEntry } from "@/hooks/useSearchHistory"

function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function SearchHistory({
  entries,
  activeId,
  onSelect,
  onRemove,
  onClear,
}: {
  entries: HistoryEntry[]
  activeId?: string | null
  onSelect: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
}) {
  const [collapsed, setCollapsed] = useState(true)

  if (entries.length === 0 && collapsed) {
    return (
      <button
        type="button"
        className="history-toggle history-toggle-empty"
        onClick={() => setCollapsed(false)}
        title="search history"
      >
        ☰
      </button>
    )
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="history-toggle"
        onClick={() => setCollapsed(false)}
        title="search history"
      >
        <span className="history-toggle-icon">☰</span>
        <span className="history-toggle-count">{entries.length}</span>
      </button>
    )
  }

  return (
    <aside className="history-rail">
      <div className="history-head">
        <span className="history-title">history</span>
        <div className="history-head-actions">
          {entries.length > 0 && (
            <button type="button" className="history-clear" onClick={onClear} title="clear all">
              clear
            </button>
          )}
          <button
            type="button"
            className="history-collapse"
            onClick={() => setCollapsed(true)}
            title="collapse"
          >
            ←
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="history-empty">
          No saved searches yet. Run a swarm and it'll show up here.
        </div>
      ) : (
        <ul className="history-list">
          {entries.map(entry => (
            <li
              key={entry.id}
              className={`history-item${activeId === entry.id ? " active" : ""}`}
            >
              <button
                type="button"
                className="history-item-main"
                onClick={() => onSelect(entry)}
              >
                <span className="history-item-query">{entry.query}</span>
                <span className="history-item-meta">
                  {entry.topPrice != null && (
                    <span className="history-item-price">${entry.topPrice}</span>
                  )}
                  {entry.topPick && (
                    <span className="history-item-pick">{entry.topPick}</span>
                  )}
                </span>
                <span className="history-item-time">{relativeTime(entry.ts)}</span>
              </button>
              <button
                type="button"
                className="history-item-remove"
                onClick={(e) => { e.stopPropagation(); onRemove(entry.id) }}
                title="remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
