"use client"

import { useCallback, useEffect, useState } from "react"
import type { AgentState, SwarmResult } from "./useSwarm"

const STORAGE_KEY = "swarm.history.v1"
const MAX_ENTRIES = 25

export interface HistoryEntry {
  id: string
  query: string
  ts: number
  topPick?: string
  topPrice?: number
  agents: AgentState[]
  result: SwarmResult
}

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota exceeded or storage disabled — fail silently, in-memory state stays.
  }
}

export function useSearchHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => { setEntries(load()) }, [])

  const save = useCallback((entry: Omit<HistoryEntry, "id" | "ts">) => {
    setEntries(prev => {
      const next: HistoryEntry[] = [
        {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ts: Date.now(),
        },
        ...prev.filter(e => e.query !== entry.query),
      ].slice(0, MAX_ENTRIES)
      persist(next)
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id)
      persist(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setEntries([])
    persist([])
  }, [])

  return { entries, save, remove, clear }
}
