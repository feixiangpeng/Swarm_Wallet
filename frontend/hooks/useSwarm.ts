"use client"

import { useState, useRef, useCallback } from "react"
import type { AgentUpdate, Finding } from "../../src/agent"
import type { Verdict } from "../../src/coordinator"
import type { AgentPlan, SwarmPlan } from "../../src/planner"

export type SwarmStatus = "idle" | "running" | "done" | "error"
export type SwarmStage = "planning" | "spawning" | "running" | "synthesizing" | "complete"

export interface AgentState extends AgentUpdate {
  finding?: Finding
}

export interface SwarmActivity {
  stage: SwarmStage
  message: string
  at: number
}

export interface SwarmResult {
  plan: SwarmPlan
  findings: Finding[]
  verdict: Verdict
  replayUrls: Record<string, string>
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001"
const CONNECTION_ERROR = "connection error - is the backend running on :3001?"

function agentId(agent: AgentPlan) {
  return `${agent.role}::${agent.site}`
}

export function useSwarm() {
  const [agents, setAgents]   = useState<AgentState[]>([])
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [status, setStatus]   = useState<SwarmStatus>("idle")
  const [activity, setActivity] = useState<SwarmActivity[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const wsRef      = useRef<WebSocket | null>(null)
  const runningRef = useRef(false)  // avoids stale closure in onclose

  const search = useCallback((query: string) => {
    if (wsRef.current) wsRef.current.close()

    setAgents([])
    setVerdict(null)
    setActivity([])
    setQuery(query)
    setError(null)
    setStatus("running")
    runningRef.current = true

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify({ query }))

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string)

      if (msg.type === "agent_update") {
        const update = msg as AgentUpdate
        setActivity(prev => [
          ...prev.slice(-7),
          {
            stage: update.status === "done" ? "running" : "running",
            message: `${update.site} · ${update.status}`,
            at: Date.now(),
          },
        ])
        setAgents(prev => {
          const idx = prev.findIndex(a => a.agentId === update.agentId)
          if (idx === -1) return [...prev, update as AgentState]
          const next = [...prev]
          next[idx] = { ...next[idx], ...update }
          return next
        })
      }

      if (msg.type === "swarm_event") {
        if (Array.isArray(msg.agents)) {
          const plannedAgents = msg.agents as AgentPlan[]
          setAgents(prev => {
            const existing = new Map(prev.map(agent => [agent.agentId, agent]))
            for (const agent of plannedAgents) {
              const id = agentId(agent)
              if (!existing.has(id)) {
                existing.set(id, {
                  agentId: id,
                  site: agent.site,
                  role: agent.role,
                  status: "queued",
                })
              }
            }
            return Array.from(existing.values())
          })
        }

        setActivity(prev => [
          ...prev.slice(-7),
          {
            stage: msg.stage as SwarmStage,
            message: msg.message as string,
            at: (msg.at as number) ?? Date.now(),
          },
        ])
      }

      if (msg.type === "verdict") {
        setVerdict(msg.verdict as Verdict)
        setStatus("done")
        runningRef.current = false
      }

      if (msg.type === "error") {
        setError((msg.message as string) || "swarm failed")
        setActivity(prev => [
          ...prev.slice(-7),
          {
            stage: "running",
            message: (msg.message as string) || "swarm failed",
            at: Date.now(),
          },
        ])
        setStatus("error")
        runningRef.current = false
      }
    }

    ws.onerror = () => {
      setError(CONNECTION_ERROR)
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

  return { agents, verdict, status, activity, query, error, search }
}
