import { z } from "zod"
import { llm } from "./semaphore"
import type { LiveAgent } from "./spawner"

const FindingSchema = z.object({
  name: z.string(),
  price: z.number().optional(),
  url: z.string(),
  source: z.string(),
  highlight: z.string(),
  confidence: z.number(),
})

export type Finding = z.infer<typeof FindingSchema>

export type AgentStatus = "navigating" | "searching" | "extracting" | "done" | "error"

export interface AgentUpdate {
  agentId: string
  site: string
  role: string
  status: AgentStatus
  currentUrl?: string
  finding?: Finding
  replayUrl: string
}

export async function runAgent(
  agent: LiveAgent,
  query: string,
  onUpdate: (u: AgentUpdate) => void
): Promise<Finding | null> {
  const { id, plan, session, replayUrl } = agent

  const emit = (status: AgentStatus, extra?: Partial<AgentUpdate>) =>
    onUpdate({ agentId: id, site: plan.site, role: plan.role, status, replayUrl, ...extra })

  try {
    // Navigate — no LLM, no semaphore, runs freely
    emit("navigating")
    await session.context.activePage()!.goto(`https://${plan.site}`)

    // Act — LLM calls, queued through semaphore
    emit("searching")
    await llm.run(() => session.act(`search for "${query}"`))
    await llm.run(() => session.act(plan.strategy))

    // Extract — LLM call, queued through semaphore
    emit("extracting")
    const finding = await llm.run(() =>
      session.extract(
        `Best result for "${query}": name, price, URL, source, and
         the single most important thing a buyer should know`,
        FindingSchema
      )
    )

    emit("done", { finding })
    return finding

  } catch {
    emit("error")
    return null
  } finally {
    await session.close()
  }
}
