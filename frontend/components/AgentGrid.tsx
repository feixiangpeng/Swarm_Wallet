import AgentCard from "./AgentCard"
import type { AgentState } from "@/hooks/useSwarm"

const LANES: Array<{
  id: string
  label: string
  statuses: string[]
}> = [
  { id: "queued", label: "queued", statuses: ["queued", "launching"] },
  { id: "navigating", label: "navigating", statuses: ["navigating"] },
  { id: "searching", label: "searching", statuses: ["searching"] },
  { id: "extracting", label: "extracting", statuses: ["extracting"] },
  { id: "done", label: "complete", statuses: ["done", "error", "launch_failed"] },
]

export default function AgentGrid({ agents }: { agents: AgentState[] }) {
  const byLane = LANES.map((lane) => ({
    ...lane,
    agents: agents.filter((agent) => lane.statuses.includes(agent.status)),
  }))

  return (
    <div className="agent-lanes" aria-label="Agent workflow lanes">
      {byLane.map((lane) => (
        <section className="agent-lane" data-lane={lane.id} key={lane.id}>
          <div className="agent-lane-header">
            <span>{lane.label}</span>
            <strong>{lane.agents.length}</strong>
          </div>
          <div className="agent-lane-stack">
            {lane.agents.length > 0 ? (
              lane.agents.map((agent, i) => (
                <AgentCard key={agent.agentId} agent={agent} index={i} compact />
              ))
            ) : (
              <div className="agent-lane-empty">no agents</div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
