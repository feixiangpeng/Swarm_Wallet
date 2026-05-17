import AgentCard from "./AgentCard"
import type { AgentState } from "@/hooks/useSwarm"

export default function AgentGrid({ agents }: { agents: AgentState[] }) {
  return (
    <div className="agent-grid">
      {agents.map((agent, i) => (
        <AgentCard key={agent.agentId} agent={agent} index={i} />
      ))}
    </div>
  )
}
