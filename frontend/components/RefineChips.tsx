"use client"

import type { Finding } from "../../src/agent"

interface Chip {
  label: string
  // The suffix appended to the current query when this chip is clicked.
  suffix: string
}

function buildChips(findings: Finding[]): Chip[] {
  const prices = findings.map(f => f.price).filter((p): p is number => typeof p === "number")
  const best = prices.length > 0 ? Math.min(...prices) : null
  // Anchor "under $X" 10% below the current best so it actually narrows.
  const target = best != null ? Math.max(1, Math.floor(best * 0.9)) : null

  const chips: Chip[] = [
    { label: "in stock only",  suffix: "in stock only" },
    { label: "refurbished",    suffix: "refurbished" },
    { label: "free shipping",  suffix: "with free shipping" },
  ]
  if (target != null) {
    chips.push({ label: `under $${target}`, suffix: `under $${target}` })
  }
  return chips
}

export default function RefineChips({
  query,
  findings,
  onRefine,
  disabled,
}: {
  query: string
  findings: Finding[]
  onRefine: (nextQuery: string) => void
  disabled?: boolean
}) {
  const chips = buildChips(findings)
  if (chips.length === 0) return null

  return (
    <div className="refine-chips">
      <span className="refine-chips-label">refine →</span>
      {chips.map(chip => (
        <button
          key={chip.label}
          type="button"
          className="refine-chip"
          disabled={disabled}
          onClick={() => onRefine(`${query} ${chip.suffix}`.trim())}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
