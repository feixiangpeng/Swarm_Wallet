import type { AgentState, SwarmActivity, SwarmStatus } from "@/hooks/useSwarm"

const STATUS_LABEL: Record<string, string> = {
  navigating: "opening",
  searching: "searching",
  extracting: "extracting",
  done: "done",
  error: "error",
}

const STAGE_LABEL: Record<string, string> = {
  planning: "planning",
  spawning: "launching",
  running: "scanning",
  synthesizing: "ranking",
  complete: "complete",
}

const PLACEHOLDER_BUBBLES = [
  { label: "retailers", stage: "planning", x: 22, y: 34 },
  { label: "reviews", stage: "planning", x: 68, y: 28 },
  { label: "deals", stage: "planning", x: 76, y: 68 },
  { label: "price graph", stage: "planning", x: 33, y: 72 },
]

function getPosition(index: number, total: number) {
  const radiusX = total > 6 ? 36 : 31
  const radiusY = total > 6 ? 31 : 27
  const angle = -Math.PI / 2 + (index / Math.max(total, 1)) * Math.PI * 2

  return {
    left: `${50 + Math.cos(angle) * radiusX}%`,
    top: `${50 + Math.sin(angle) * radiusY}%`,
  }
}

function getStage(activity: SwarmActivity[], status: SwarmStatus) {
  if (status === "done") return "complete"
  if (status === "error") return "error"
  return activity.at(-1)?.stage ?? "planning"
}

export default function SwarmMap({
  agents,
  activity,
  status,
  query,
}: {
  agents: AgentState[]
  activity: SwarmActivity[]
  status: SwarmStatus
  query: string
}) {
  const activeStage = getStage(activity, status)
  const completed = agents.filter(agent => agent.status === "done").length
  const failed = agents.filter(agent => agent.status === "error").length
  const total = agents.length
  const progress = total > 0 ? ((completed + failed) / total) * 100 : activeStage === "planning" ? 8 : 18
  const visibleActivity = activity.slice(-6).reverse()

  return (
    <section className="swarm-shell" aria-label="Live swarm scanner">
      <div className="swarm-stage">
        <div className="swarm-grid-field" />
        <div className="swarm-radar" />

        <div className="swarm-core">
          <div className="swarm-core-ring" />
          <div className="swarm-core-label">target</div>
          <div className="swarm-core-query">{query || "purchase query"}</div>
          <div className="swarm-core-stage">{STAGE_LABEL[activeStage] ?? activeStage}</div>
        </div>

        {agents.length === 0 ? (
          PLACEHOLDER_BUBBLES.map((bubble, index) => (
            <div
              key={bubble.label}
              className="swarm-bubble placeholder"
              data-status={bubble.stage}
              style={{
                left: `${bubble.x}%`,
                top: `${bubble.y}%`,
                animationDelay: `${index * 0.12}s`,
              }}
            >
              <span className="bubble-pulse" />
              <span className="bubble-site">{bubble.label}</span>
              <span className="bubble-status">queued</span>
            </div>
          ))
        ) : (
          agents.map((agent, index) => {
            const position = getPosition(index, agents.length)
            return (
              <a
                key={agent.agentId}
                className="swarm-bubble"
                data-status={agent.status}
                href={agent.replayUrl || undefined}
                target="_blank"
                rel="noreferrer"
                style={{ ...position, animationDelay: `${index * 0.06}s` }}
                title={agent.replayUrl ? `Open ${agent.site} replay` : agent.site}
              >
                <span className="bubble-pulse" />
                <span className="bubble-site">{agent.site}</span>
                <span className="bubble-role">{agent.role}</span>
                <span className="bubble-status">{STATUS_LABEL[agent.status] ?? agent.status}</span>
                {agent.finding && (
                  <span className="bubble-finding">
                    {agent.finding.name}
                    {agent.finding.price != null ? ` · $${agent.finding.price}` : ""}
                  </span>
                )}
              </a>
            )
          })
        )}
      </div>

      <aside className="swarm-panel">
        <div className="swarm-panel-header">
          <span>scan telemetry</span>
          <strong>{total > 0 ? `${completed + failed}/${total}` : "warming up"}</strong>
        </div>

        <div className="swarm-progress" aria-label="Scan progress">
          <span style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>

        <div className="swarm-metrics">
          <div>
            <strong>{total || "—"}</strong>
            <span>agents</span>
          </div>
          <div>
            <strong>{completed}</strong>
            <span>done</span>
          </div>
          <div>
            <strong>{failed}</strong>
            <span>failed</span>
          </div>
        </div>

        <div className="swarm-activity">
          {visibleActivity.length === 0 ? (
            <div className="activity-empty">waiting for first signal</div>
          ) : (
            visibleActivity.map((item, index) => (
              <div className="activity-row" data-stage={item.stage} key={`${item.at}-${index}`}>
                <span className="activity-dot" />
                <span className="activity-message">{item.message}</span>
                <span className="activity-time">
                  {new Date(item.at).toLocaleTimeString("en-US", {
                    hour12: false,
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>
    </section>
  )
}
