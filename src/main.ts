import { planSwarm } from "./planner"
import { agentId, spawnAgent } from "./spawner"
import { runAgent, type AgentUpdate, type Finding } from "./agent"
import { synthesize } from "./coordinator"
import { getMaxBrowserSessions } from "./config"
import type { AgentPlan } from "./planner"

export interface SwarmEvent {
  stage: "planning" | "spawning" | "running" | "synthesizing" | "complete"
  message: string
  agents?: AgentPlan[]
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
) {
  const results: R[] = []
  let cursor = 0

  async function runNext() {
    while (cursor < items.length) {
      if (signal?.aborted) return
      const index = cursor
      const item = items[cursor]
      cursor += 1
      results[index] = await worker(item, index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runNext())
  )

  return results
}

export class SwarmCancelledError extends Error {
  constructor() { super("swarm cancelled"); this.name = "SwarmCancelledError" }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new SwarmCancelledError()
}

export interface SwarmSearchOptions {
  allowedSites?: string[]
}

export async function swarmSearch(
  query: string,
  onUpdate: (u: AgentUpdate) => void,
  onEvent?: (event: SwarmEvent) => void,
  signal?: AbortSignal,
  options: SwarmSearchOptions = {},
) {
  throwIfAborted(signal)
  onEvent?.({ stage: "planning", message: "mapping retailers and review sources" })
  const plan = await planSwarm(query, { allowedSites: options.allowedSites })
  throwIfAborted(signal)
  console.log(`${plan.agents.length} agents for "${plan.product}"`)

  const maxSessions = getMaxBrowserSessions()
  onEvent?.({
    stage: "spawning",
    message: `queueing ${plan.agents.length} agents, ${Math.min(plan.agents.length, maxSessions)} at a time`,
    agents: plan.agents,
  })

  onEvent?.({ stage: "running", message: "agents are searching in parallel" })
  const replayUrls: Record<string, string> = {}
  const results = await runWithConcurrency(
    plan.agents,
    Math.max(1, maxSessions),
    async (agentPlan) => {
      const id = agentId(agentPlan)
      if (signal?.aborted) return null
      onUpdate({
        agentId: id,
        site: agentPlan.site,
        role: agentPlan.role,
        status: "launching",
      })

      try {
        const liveAgent = await spawnAgent(agentPlan)
        if (signal?.aborted) return null
        replayUrls[id] = liveAgent.replayUrl
        return runAgent(liveAgent, query, onUpdate)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`Failed to launch ${agentPlan.site}:`, err)
        onUpdate({
          agentId: id,
          site: agentPlan.site,
          role: agentPlan.role,
          status: "launch_failed",
          error: message,
        })
        return null
      }
    },
    signal,
  )

  throwIfAborted(signal)
  const findings = results.filter(Boolean) as Finding[]
  if (findings.length === 0) {
    throw new Error("No agents returned findings. Check Browserbase quota, site blocks, or lower MAX_BROWSER_SESSIONS.")
  }

  onEvent?.({ stage: "synthesizing", message: "ranking findings into a verdict" })
  const verdict = await synthesize(query, findings)
  throwIfAborted(signal)

  onEvent?.({ stage: "complete", message: "purchase intelligence ready" })
  return { plan, findings, verdict, replayUrls }
}
