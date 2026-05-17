import { planSwarm } from "./planner"
import { spawnAgents } from "./spawner"
import { runAgent, type AgentUpdate, type Finding } from "./agent"
import { synthesize } from "./coordinator"

export interface SwarmEvent {
  stage: "planning" | "spawning" | "running" | "synthesizing" | "complete"
  message: string
}

export async function swarmSearch(
  query: string,
  onUpdate: (u: AgentUpdate) => void,
  onEvent?: (event: SwarmEvent) => void
) {
  onEvent?.({ stage: "planning", message: "mapping retailers and review sources" })
  const plan = await planSwarm(query)
  console.log(`${plan.agents.length} agents for "${plan.product}"`)

  const maxSessions = Number(process.env.MAX_BROWSER_SESSIONS ?? 4)
  onEvent?.({
    stage: "spawning",
    message: `launching ${Math.min(plan.agents.length, maxSessions)} browser sessions`,
  })
  const liveAgents = await spawnAgents(plan.agents)
  if (liveAgents.length === 0) {
    throw new Error("No browser sessions launched. Check Browserbase API key, project ID, or session quota.")
  }

  onEvent?.({ stage: "running", message: "agents are searching in parallel" })
  const results = await Promise.all(
    liveAgents.map(agent => runAgent(agent, query, onUpdate))
  )

  const findings = results.filter(Boolean) as Finding[]
  const replayUrls = Object.fromEntries(liveAgents.map(a => [a.id, a.replayUrl]))

  onEvent?.({ stage: "synthesizing", message: "ranking findings into a verdict" })
  const verdict = await synthesize(query, findings)

  onEvent?.({ stage: "complete", message: "purchase intelligence ready" })
  return { plan, findings, verdict, replayUrls }
}
