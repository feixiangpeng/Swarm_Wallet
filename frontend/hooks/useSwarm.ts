"use client"

import { useState, useRef, useCallback } from "react"
import type { AgentUpdate, Finding } from "../../src/agent"
import type { Verdict } from "../../src/coordinator"
import type { SwarmPlan } from "../../src/planner"

export type SwarmStatus = "idle" | "running" | "done" | "error"

export interface AgentState extends AgentUpdate {
  finding?: Finding
}

export interface SwarmResult {
  plan: SwarmPlan
  findings: Finding[]
  verdict: Verdict
  replayUrls: Record<string, string>
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001"

export function useSwarm() {
  const [agents, setAgents]   = useState<AgentState[]>([])
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [status, setStatus]   = useState<SwarmStatus>("idle")
  const wsRef      = useRef<WebSocket | null>(null)
  const runningRef = useRef(false)  // avoids stale closure in onclose

  const search = useCallback((query: string) => {
    if (wsRef.current) wsRef.current.close()

    setAgents([])
    setVerdict(null)
    setStatus("running")
    runningRef.current = true

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify({ query }))

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string)

      if (msg.type === "agent_update") {
        const update = msg as AgentUpdate
        setAgents(prev => {
          const idx = prev.findIndex(a => a.agentId === update.agentId)
          if (idx === -1) return [...prev, update as AgentState]
          const next = [...prev]
          next[idx] = { ...next[idx], ...update }
          return next
        })
      }

      if (msg.type === "verdict") {
        setVerdict(msg.verdict as Verdict)
        setStatus("done")
        runningRef.current = false
      }

      if (msg.type === "error") {
        setStatus("error")
        runningRef.current = false
      }
    }

    ws.onerror = () => {
      setStatus("error")
      runningRef.current = false
    }

    ws.onclose = () => {
      if (runningRef.current) {
        setStatus("done")
        runningRef.current = false
      }
    }
  }, [])

  return { agents, verdict, status, search }
}
