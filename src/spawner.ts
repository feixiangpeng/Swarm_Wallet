import { acquireBrowserbaseSession } from "./sessionPool"
import type { V3 } from "./stagehand"
import type { AgentPlan } from "./planner"

export interface LiveAgent {
  id: string
  plan: AgentPlan
  session: V3
  replayUrl: string
}

export function agentId(plan: AgentPlan) {
  return `${plan.role}::${plan.site}`
}

export async function spawnAgent(plan: AgentPlan): Promise<LiveAgent> {
  const session = await acquireBrowserbaseSession()

  const sessionId = session.browserbaseSessionID ?? "unknown"
  return {
    id: agentId(plan),
    plan,
    session,
    replayUrl: session.browserbaseDebugURL ?? session.browserbaseSessionURL ?? `https://browserbase.com/sessions/${sessionId}`,
  }
}
