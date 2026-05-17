import { planSwarm } from "./planner"
import { agentId, spawnAgent } from "./spawner"
import { runAgent, type AgentUpdate, type Finding } from "./agent"
import { synthesize } from "./coordinator"
import { getMaxBrowserSessions } from "./config"
import type { AgentPlan } from "./planner"
import {
  buildIntelligenceContext,
  emptyIntelligenceContext,
  isSnowflakeEnabled,
} from "./snowflake/index"
import type { FindingRow } from "./snowflake/persist"

export interface SwarmEvent {
  stage: "planning" | "spawning" | "running" | "synthesizing" | "complete"
  message: string
  agents?: AgentPlan[]
}

export interface SwarmSearchResult {
  plan: Awaited<ReturnType<typeof planSwarm>>
  findings: Finding[]
  findingRows: FindingRow[]
  verdict: Awaited<ReturnType<typeof synthesize>>
  replayUrls: Record<string, string>
  searchId: string
  startedAt: number
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results: R[] = []
  let cursor = 0

  async function runNext() {
    while (cursor < items.length) {
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

export async function swarmSearch(
  query: string,
  onUpdate: (u: AgentUpdate) => void,
  onEvent?: (event: SwarmEvent) => void,
  options?: { searchId?: string }
): Promise<SwarmSearchResult> {
  const searchId = options?.searchId ?? crypto.randomUUID()
  const startedAt = Date.now()

  onEvent?.({ stage: "planning", message: "mapping retailers and review sources" })
  const plan = await planSwarm(query)
  console.log(`${plan.agents.length} agents for "${plan.product}"`)
  if (isSnowflakeEnabled()) {
    console.log(`[snowflake] planner: ${plan.reasoning}`)
  }

  const maxSessions = getMaxBrowserSessions()
  onEvent?.({
    stage: "spawning",
    message: `queueing ${plan.agents.length} agents, ${Math.min(plan.agents.length, maxSessions)} at a time`,
    agents: plan.agents,
  })

  onEvent?.({ stage: "running", message: "agents are searching in parallel" })
  const replayUrls: Record<string, string> = {}
  const findingRows: FindingRow[] = []

  const results = await runWithConcurrency(
    plan.agents,
    Math.max(1, maxSessions),
    async (agentPlan) => {
      const id = agentId(agentPlan)
      onUpdate({
        agentId: id,
        site: agentPlan.site,
        role: agentPlan.role,
        status: "launching",
      })

      try {
        const liveAgent = await spawnAgent(agentPlan)
        replayUrls[id] = liveAgent.replayUrl
        const finding = await runAgent(liveAgent, query, onUpdate)
        if (finding) {
          findingRows.push({
            finding,
            agentId: id,
            site: agentPlan.site,
            role: agentPlan.role,
            replayUrl: liveAgent.replayUrl,
          })
        }
        return finding
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
    }
  )

  const findings = results.filter(Boolean) as Finding[]
  if (findings.length === 0) {
    throw new Error("No agents returned findings. Check Browserbase quota, site blocks, or lower MAX_BROWSER_SESSIONS.")
  }

  onEvent?.({ stage: "synthesizing", message: "ranking findings into a verdict" })

  const intelligence = isSnowflakeEnabled()
    ? await buildIntelligenceContext(query, findings)
    : emptyIntelligenceContext()

  if (intelligence.insights.outliers.length > 0) {
    console.log(
      `[snowflake] ${intelligence.insights.outliers.length} outlier(s) flagged`
    )
  }

  const verdict = await synthesize(query, findings, intelligence)

  onEvent?.({ stage: "complete", message: "purchase intelligence ready" })
  return {
    plan,
    findings,
    findingRows,
    verdict,
    replayUrls,
    searchId,
    startedAt,
  }
}
