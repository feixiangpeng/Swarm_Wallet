import type { AgentState } from "@/hooks/useSwarm"

const STATUS_LABEL: Record<string, string> = {
  navigating: "navigating",
  searching:  "searching",
  extracting: "extracting",
  done:       "done",
  error:      "error",
}

export default function AgentCard({ agent, index }: { agent: AgentState; index: number }) {
  return (
    <div
      className="agent-card"
      data-status={agent.status}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="card-header">
        <span className="card-site">{agent.site}</span>
        <div className="card-meta">
          <span className="card-role">{agent.role}</span>
          <span className="card-status-dot" />
          <span className="card-status-label">{STATUS_LABEL[agent.status] ?? agent.status}</span>
        </div>
      </div>

      <div className="card-iframe-wrap">
        {agent.replayUrl ? (
          <iframe
            className="card-iframe"
            src={agent.replayUrl}
            title={`${agent.site} replay`}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="card-iframe-placeholder">waiting for session</div>
        )}
      </div>

      {agent.status === "error" && (
        <div className="card-error">agent failed — site may be unreachable</div>
      )}

      {agent.finding && (
        <div className="card-finding">
          <div className="card-finding-name">{agent.finding.name}</div>
          {agent.finding.price != null && (
            <div className="card-finding-price">${agent.finding.price}</div>
          )}
          <div className="card-finding-highlight">{agent.finding.highlight}</div>
        </div>
      )}
    </div>
  )
}
