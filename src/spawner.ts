import { createBrowserbaseSession, type V3 } from "./stagehand"
import type { AgentPlan } from "./planner"

export interface LiveAgent {
  id: string
  plan: AgentPlan
  session: V3
  replayUrl: string
}

export async function spawnAgents(agents: AgentPlan[]): Promise<LiveAgent[]> {
  return Promise.all(
    agents.map(async (plan) => {
      const session = createBrowserbaseSession()
      await session.init()

      const sessionId = session.browserbaseSessionID ?? "unknown"
      return {
        id: `${plan.role}::${plan.site}`,
        plan,
        session,
        replayUrl: `https://browserbase.com/sessions/${sessionId}`,
      }
    })
  )
}
