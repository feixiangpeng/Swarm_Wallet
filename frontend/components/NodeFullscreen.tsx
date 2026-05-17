"use client"

import { useEffect } from "react"
import type { AgentState } from "@/hooks/useSwarm"

export default function NodeFullscreen({
  agent,
  onClose,
}: {
  agent: AgentState
  onClose: () => void
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div className="node-fullscreen-overlay" onClick={onClose}>
      <div className="node-fullscreen-modal" onClick={e => e.stopPropagation()}>
        <div className="node-fullscreen-header">
          <div className="node-fullscreen-meta">
            <span className="node-fullscreen-site">{agent.site}</span>
            <span className="node-fullscreen-role">{agent.role}</span>
            <span className={`node-fullscreen-status`} data-status={agent.status}>
              {agent.status}
            </span>
          </div>
          <div className="node-fullscreen-actions">
            {agent.replayUrl && (
              <a
                href={agent.replayUrl}
                target="_blank"
                rel="noreferrer"
                className="node-fullscreen-ext"
              >
                open in browserbase ↗
              </a>
            )}
            <button className="node-fullscreen-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="node-fullscreen-body">
          {agent.replayUrl ? (
            <iframe
              src={agent.replayUrl}
              className="node-fullscreen-iframe"
              sandbox="allow-scripts allow-same-origin"
              title={`${agent.site} full replay`}
            />
          ) : (
            <div className="node-fullscreen-empty">no session recorded</div>
          )}
        </div>

        {agent.finding && (
          <div className="node-fullscreen-finding">
            <span className="nff-name">{agent.finding.name}</span>
            {agent.finding.price != null && <span className="nff-price">${agent.finding.price}</span>}
            {agent.finding.highlight && <span className="nff-highlight">{agent.finding.highlight}</span>}
            {agent.finding.confidence != null && (
              <span className="nff-conf">{Math.round(agent.finding.confidence * 100)}% confidence</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
