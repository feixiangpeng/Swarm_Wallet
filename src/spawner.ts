import { createBrowserbaseSession, type V3 } from "./stagehand"
import type { AgentPlan } from "./planner"

export interface LiveAgent {
  id: string
  plan: AgentPlan
  session: V3
  replayUrl: string
}

const MAX_BROWSER_SESSIONS = Number(process.env.MAX_BROWSER_SESSIONS ?? 4)

export async function spawnAgents(agents: AgentPlan[]): Promise<LiveAgent[]> {
  const selectedAgents = agents.slice(0, MAX_BROWSER_SESSIONS)
  const results: LiveAgent[] = []

  for (const plan of selectedAgents) {
    try {
      const session = createBrowserbaseSession()
      await session.init()

      const sessionId = session.browserbaseSessionID ?? "unknown"
      results.push({
        id: `${plan.role}::${plan.site}`,
        plan,
        session,
        replayUrl: `https://browserbase.com/sessions/${sessionId}`,
      })
    } catch (err) {
      console.error(`Failed to launch ${plan.site}:`, err)
    }
  }

  return results
}
