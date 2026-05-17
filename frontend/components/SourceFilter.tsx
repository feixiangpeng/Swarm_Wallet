"use client"

import { useEffect, useRef, useState } from "react"

export const AVAILABLE_SITES = [
  "amazon.com",
  "bestbuy.com",
  "target.com",
  "walmart.com",
  "ebay.com",
  "etsy.com",
] as const

export type SiteId = typeof AVAILABLE_SITES[number]

export default function SourceFilter({
  selected,
  onChange,
  disabled,
}: {
  selected: SiteId[]
  onChange: (next: SiteId[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const toggle = (site: SiteId) => {
    if (selected.includes(site)) {
      // Don't allow zero sites — leave at least one selected.
      if (selected.length === 1) return
      onChange(selected.filter(s => s !== site))
    } else {
      onChange([...selected, site])
    }
  }

  const allOn = selected.length === AVAILABLE_SITES.length
  const label = allOn ? "all sources" : `${selected.length}/${AVAILABLE_SITES.length} sources`

  return (
    <div className="source-filter" ref={rootRef}>
      <button
        type="button"
        className={`source-filter-trigger${open ? " open" : ""}`}
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        title="filter sources"
      >
        <span className="source-filter-gear">⚙</span>
        {label}
      </button>
      {open && (
        <div className="source-filter-pop">
          <div className="source-filter-head">
            <span>retailers to scan</span>
            <button
              type="button"
              className="source-filter-all"
              onClick={() => onChange([...AVAILABLE_SITES])}
              disabled={allOn}
            >
              select all
            </button>
          </div>
          <ul className="source-filter-list">
            {AVAILABLE_SITES.map(site => {
              const on = selected.includes(site)
              return (
                <li key={site}>
                  <label className="source-filter-row">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(site)}
                    />
                    <span>{site}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
