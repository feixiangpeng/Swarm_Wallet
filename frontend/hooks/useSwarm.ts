"use client"

import { useState, useRef, useCallback } from "react"
import type { AgentUpdate, Finding } from "../../src/agent"
import type { Verdict } from "../../src/coordinator"
import type { AgentPlan, SwarmPlan } from "../../src/planner"

export type SwarmStatus = "idle" | "running" | "done" | "error" | "cancelled"
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
  const [findings, setFindings] = useState<Finding[]>([])
  const [status, setStatus]   = useState<SwarmStatus>("idle")
  const [activity, setActivity] = useState<SwarmActivity[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const wsRef      = useRef<WebSocket | null>(null)
  const runningRef = useRef(false)  // avoids stale closure in onclose

  const search = useCallback((input: string, options: { allowedSites?: string[] } = {}) => {
    if (wsRef.current) wsRef.current.close()

    const trimmed = input.trim()
    const isUrl = /^https?:\/\/\S+$/i.test(trimmed)

    setAgents([])
    setVerdict(null)
    setFindings([])
    setActivity([])
    setQuery(trimmed)  // Will be replaced by the resolved product name once the server reports it.
    setError(null)
    setStatus("running")
    runningRef.current = true

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify(
      isUrl
        ? { mode: "url", url: trimmed, allowedSites: options.allowedSites }
        : { query: trimmed, allowedSites: options.allowedSites }
    ))

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
        if (typeof msg.resolvedQuery === "string") {
          setQuery(msg.resolvedQuery)
        }
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
        if (typeof msg.resolvedQuery === "string") setQuery(msg.resolvedQuery)
        setVerdict(msg.verdict as Verdict)
        setFindings((msg.findings as Finding[]) ?? [])
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

  const cancel = useCallback(() => {
    if (!runningRef.current) return
    const ws = wsRef.current
    if (ws && ws.readyState !== WebSocket.CLOSED) ws.close()
    runningRef.current = false
    setStatus("cancelled")
    setActivity(prev => [
      ...prev.slice(-7),
      { stage: "running", message: "cancelled by you", at: Date.now() },
    ])
  }, [])

  return { agents, verdict, findings, status, activity, query, error, search, cancel }
}
