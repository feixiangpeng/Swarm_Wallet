import { planSwarm } from "./planner"
import { spawnAgents } from "./spawner"
import { runAgent, type AgentUpdate, type Finding } from "./agent"
import { synthesize } from "./coordinator"

export async function swarmSearch(
  query: string,
  onUpdate: (u: AgentUpdate) => void
) {
  const plan = await planSwarm(query)
  console.log(`${plan.agents.length} agents for "${plan.product}"`)

  const liveAgents = await spawnAgents(plan.agents)

  const results = await Promise.all(
    liveAgents.map(agent => runAgent(agent, query, onUpdate))
  )

  const findings = results.filter(Boolean) as Finding[]
  const replayUrls = Object.fromEntries(liveAgents.map(a => [a.id, a.replayUrl]))
  const verdict = await synthesize(query, findings)

  return { plan, findings, verdict, replayUrls }
}
