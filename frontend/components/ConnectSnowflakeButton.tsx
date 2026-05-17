"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

type Health = {
  ok?: boolean
  snowflake?: boolean
  semantic_search?: boolean
  backend?: boolean
}

export default function ConnectSnowflakeButton({
  variant = "hero",
}: {
  variant?: "hero" | "header"
}) {
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" })
        const json = (await res.json()) as Health
        if (!cancelled) setHealth({ ...json, backend: res.ok })
      } catch {
        if (!cancelled) setHealth({ ok: false, snowflake: false, backend: false })
      }
    }
    void check()
    const id = setInterval(() => void check(), 20_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const backendUp = health?.backend ?? health?.ok
  const snowflakeOn = health?.snowflake === true
  const semanticOn = health?.semantic_search === true

  const statusLabel = !health
    ? "checking…"
    : !backendUp
      ? "backend offline"
      : semanticOn
        ? "snowflake + semantic"
        : snowflakeOn
          ? "snowflake connected"
          : "snowflake not configured"

  return (
    <Link
      href="/memory"
      className={`connect-snowflake connect-snowflake--${variant}`}
      title="Open Snowflake swarm memory dashboard"
    >
      <span
        className="connect-snowflake-dot"
        data-status={
          !health ? "pending" : semanticOn ? "live" : snowflakeOn ? "partial" : backendUp ? "partial" : "off"
        }
        aria-hidden
      />
      <span className="connect-snowflake-text">
        {variant === "hero" ? "connect snowflake memory" : "snowflake"}
      </span>
      <span className="connect-snowflake-status">{statusLabel}</span>
      {variant === "hero" && <span className="connect-snowflake-arrow">→</span>}
    </Link>
  )
}
