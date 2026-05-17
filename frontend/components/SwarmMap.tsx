"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import type { AgentState, SwarmActivity, SwarmStatus } from "@/hooks/useSwarm"
import NodeFullscreen from "./NodeFullscreen"

const STATUS_COLOR: Record<string, string> = {
  queued:       "#f59e0b",
  launching:    "#f59e0b",
  navigating:   "#f59e0b",
  searching:    "#60a5fa",
  extracting:   "#a78bfa",
  done:         "#34d399",
  launch_failed:"#f87171",
  error:        "#f87171",
  planning:     "#f59e0b",
}

const STATUS_LABEL: Record<string, string> = {
  queued:       "queued",
  launching:    "launching",
  navigating:   "opening",
  searching:    "searching",
  extracting:   "extracting",
  done:         "done",
  launch_failed:"failed",
  error:        "failed",
}

const STAGE_STEPS = ["planning", "spawning", "running", "synthesizing", "complete"] as const
const STAGE_LABEL: Record<string, string> = {
  planning:     "Planning routes",
  spawning:     "Launching browsers",
  running:      "Agents scanning",
  synthesizing: "Synthesizing findings",
  complete:     "Complete",
  error:        "Error",
}

const SKELETON_LINES = [85, 60, 75, 45, 90, 55]

function NodeSkeleton() {
  return (
    <div className="node-skeleton">
      <div className="node-skeleton-bar" />
      {SKELETON_LINES.map((w, i) => (
        <div key={i} className="node-skeleton-line" style={{ width: `${w}%`, animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  )
}

// Card that pops up above a node when it has a finding
function FindingCard({ agent, cx, cy, radius }: { agent: AgentState; cx: number; cy: number; radius: number }) {
  if (!agent.finding) return null
  const { finding } = agent
  const cardW = 180
  const cardH = finding.highlight ? 88 : 64
  const x = cx - cardW / 2
  const y = cy - radius - cardH - 14

  return (
    <foreignObject x={x} y={y} width={cardW} height={cardH + 16} style={{ overflow: "visible" }}>
      <div className="finding-card">
        <div className="finding-card-header">
          <span className="finding-card-site">{agent.site.replace("www.", "")}</span>
          {finding.confidence != null && (
            <span className="finding-card-conf" style={{ "--conf": `${Math.round(finding.confidence * 100)}%` } as React.CSSProperties}>
              {Math.round(finding.confidence * 100)}%
            </span>
          )}
        </div>
        {finding.price != null && (
          <div className="finding-card-price">${finding.price}</div>
        )}
        {finding.highlight && (
          <div className="finding-card-highlight">{finding.highlight}</div>
        )}
        <div className="finding-card-arrow" />
      </div>
    </foreignObject>
  )
}

function AgentNode({ agent, cx, cy, radius, onExpand }: {
  agent: AgentState; cx: number; cy: number; radius: number
  onExpand: (agent: AgentState) => void
}) {
  const color = STATUS_COLOR[agent.status] ?? "#475569"
  const isLive = !["done", "error", "launch_failed"].includes(agent.status)
  const d = radius * 2

  return (
    <>
      {agent.status === "done" && <FindingCard agent={agent} cx={cx} cy={cy} radius={radius} />}
      <foreignObject x={cx - radius} y={cy - radius} width={d} height={d} style={{ overflow: "visible" }}>
        <div
          className="agent-node"
          data-status={agent.status}
          style={{ "--node-color": color, width: d, height: d, cursor: "pointer" } as React.CSSProperties}
          title={`${agent.site} — click to expand`}
          onClick={() => onExpand(agent)}
        >
          <div className="agent-node-ring" />
          {isLive && <div className="agent-node-live" style={{ background: color }} />}
          <div className="agent-node-screen">
            {(agent as AgentState & { screenshot?: string }).screenshot ? (
              <img className="agent-node-screenshot" src={(agent as AgentState & { screenshot?: string }).screenshot} alt="" />
            ) : agent.replayUrl ? (
              <iframe src={agent.replayUrl} title={agent.site} className="agent-node-iframe" sandbox="allow-scripts allow-same-origin" />
            ) : (
              <NodeSkeleton />
            )}
          </div>
          <div className="agent-node-label">
            <span className="agent-node-site">{agent.site.replace("www.", "")}</span>
            <span className="agent-node-status" style={{ color }}>{STATUS_LABEL[agent.status] ?? agent.status}</span>
          </div>
          {agent.finding && (
            <div className="agent-node-finding">
              {agent.finding.price != null ? `$${agent.finding.price}` : "✓"}
            </div>
          )}
          {/* expand hint */}
          <div className="agent-node-expand">⤢</div>
        </div>
      </foreignObject>
    </>
  )
}

function PlaceholderNode({ cx, cy, radius, label, delay }: { cx: number; cy: number; radius: number; label: string; delay: number }) {
  const d = radius * 2
  return (
    <foreignObject x={cx - radius} y={cy - radius} width={d} height={d} style={{ overflow: "visible" }}>
      <div className="agent-node agent-node-placeholder" style={{ width: d, height: d, animationDelay: `${delay}s` } as React.CSSProperties}>
        <div className="agent-node-screen"><NodeSkeleton /></div>
        <div className="agent-node-label">
          <span className="agent-node-site">{label}</span>
          <span className="agent-node-status" style={{ color: "#f59e0b" }}>queued</span>
        </div>
      </div>
    </foreignObject>
  )
}

const PLACEHOLDERS = ["retailers", "reviews", "deals", "price tracker"]

export default function SwarmMap({ agents, activity, status, query }: {
  agents: AgentState[]
  activity: SwarmActivity[]
  status: SwarmStatus
  query: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 800, h: 520 })
  const [zoomed, setZoomed]   = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const [expanded, setExpanded] = useState<AgentState | null>(null)
  const prevAgentCount = useRef(0)
  const onExpand = useCallback((a: AgentState) => setExpanded(a), [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Zoom in when agents first appear
  useEffect(() => {
    if (agents.length > 0 && !zoomed) setZoomed(true)
  }, [agents.length, zoomed])

  // Pulse when a new agent is added
  useEffect(() => {
    if (agents.length > prevAgentCount.current && prevAgentCount.current > 0) {
      setPulsing(true)
      const t = setTimeout(() => setPulsing(false), 600)
      return () => clearTimeout(t)
    }
    prevAgentCount.current = agents.length
  }, [agents.length])

  const { w, h } = dims
  const cx = w / 2
  const cy = h / 2
  const nodeR    = Math.min(Math.max(w / 10, 52), 74)
  const orbitR   = Math.min(w, h) * 0.36
  const coreR    = nodeR * 1.05

  const activeStage = status === "done" ? "complete" : status === "error" ? "error" : (activity.at(-1)?.stage ?? "planning")
  const completed   = agents.filter(a => a.status === "done").length
  const failed      = agents.filter(a => a.status === "error" || a.status === "launch_failed").length
  const total       = agents.length
  const progress    = total > 0 ? ((completed + failed) / total) * 100 : activeStage === "planning" ? 8 : 18
  const visibleActivity = activity.slice(-5).reverse()
  const items       = agents.length > 0 ? agents : PLACEHOLDERS.map(label => ({ _placeholder: true, label }))

  return (
  <>
    <section className="swarm-shell">
      <div
        className={`swarm-stage${zoomed ? " zoomed" : ""}${pulsing ? " pulsing" : ""}`}
        ref={containerRef}
      >
        {/* ── Background SVG: animated orbit rings ── */}
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          {/* Outer dashed ring — rotates CCW */}
          <circle cx={cx} cy={cy} r={orbitR * 1.18} fill="none"
            stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="6 12"
            style={{ transformOrigin: `${cx}px ${cy}px`, animation: "orbit-ccw 40s linear infinite" }}
          />
          {/* Main orbit ring — CW */}
          <circle cx={cx} cy={cy} r={orbitR} fill="none"
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 8"
            style={{ transformOrigin: `${cx}px ${cy}px`, animation: "orbit-cw 28s linear infinite" }}
          />
          {/* Inner ring — CCW faster */}
          <circle cx={cx} cy={cy} r={orbitR * 0.58} fill="none"
            stroke="rgba(52,211,153,0.07)" strokeWidth="1"
            style={{ transformOrigin: `${cx}px ${cy}px`, animation: "orbit-ccw 18s linear infinite" }}
          />
          {/* Radar sweep arc */}
          <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: "orbit-cw 6s linear infinite" }}>
            <defs>
              <radialGradient id="radarGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(52,211,153,0)" />
                <stop offset="100%" stopColor="rgba(52,211,153,0.12)" />
              </radialGradient>
            </defs>
            <path
              d={`M ${cx} ${cy} L ${cx} ${cy - orbitR} A ${orbitR} ${orbitR} 0 0 1 ${cx + orbitR * Math.sin(Math.PI / 6)} ${cy - orbitR * Math.cos(Math.PI / 6)} Z`}
              fill="url(#radarGrad)"
            />
          </g>
          {/* Connector lines */}
          {items.map((item, i) => {
            const angle = -Math.PI / 2 + (i / items.length) * Math.PI * 2
            const nx = cx + Math.cos(angle) * orbitR
            const ny = cy + Math.sin(angle) * orbitR
            const agent = "agentId" in item ? (item as AgentState) : null
            const color = agent ? (STATUS_COLOR[agent.status] ?? "#334155") : "#1e293b"
            const isDone = agent?.status === "done"
            const isActive = agent && !["done","error","launch_failed"].includes(agent.status)
            return (
              <line key={i}
                x1={cx} y1={cy} x2={nx} y2={ny}
                stroke={color}
                strokeWidth={isDone ? "1.5" : "1"}
                strokeOpacity={isDone ? 0.6 : isActive ? 0.35 : 0.1}
                strokeDasharray={isDone ? "none" : "4 6"}
                style={isActive ? { animation: "dash-flow 1.2s linear infinite" } : undefined}
              />
            )
          })}
        </svg>

        {/* Center core */}
        <div className="swarm-core" style={{ left: cx, top: cy, width: coreR * 2, height: coreR * 2, marginLeft: -coreR, marginTop: -coreR }}>
          <div className="swarm-core-ring" />
          <div className="swarm-core-ring-outer" />
          <div className="swarm-core-label">target</div>
          <div className="swarm-core-query">{query || "…"}</div>
          <div className="swarm-core-stage">{STAGE_LABEL[activeStage] ?? activeStage}</div>
        </div>

        {/* Agent / placeholder nodes + finding cards */}
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "visible" }}>
          {items.map((item, i) => {
            const angle = -Math.PI / 2 + (i / items.length) * Math.PI * 2
            const nx = cx + Math.cos(angle) * orbitR
            const ny = cy + Math.sin(angle) * orbitR
            if ("agentId" in item) {
              return <AgentNode key={(item as AgentState).agentId} agent={item as AgentState} cx={nx} cy={ny} radius={nodeR} onExpand={onExpand} />
            }
            const p = item as { _placeholder: boolean; label: string }
            return <PlaceholderNode key={p.label} cx={nx} cy={ny} radius={nodeR} label={p.label} delay={i * 0.15} />
          })}
        </svg>
      </div>

      {/* Right panel */}
      <aside className="swarm-panel">
        <div className="stage-tracker">
          {STAGE_STEPS.map((step, i) => {
            const stepIdx = STAGE_STEPS.indexOf(activeStage as typeof STAGE_STEPS[number])
            const done   = i < stepIdx || activeStage === "complete"
            const active = step === activeStage
            return (
              <div key={step} className={`stage-step${active ? " active" : ""}${done ? " done" : ""}`}>
                <div className="stage-step-dot">
                  {done ? "✓" : active ? <span className="stage-dot-pulse" /> : null}
                </div>
                <div className="stage-step-info">
                  <div className="stage-step-label">{STAGE_LABEL[step]}</div>
                </div>
                {i < STAGE_STEPS.length - 1 && <div className="stage-step-line" />}
              </div>
            )
          })}
        </div>

        <div className="swarm-progress"><span style={{ width: `${Math.min(progress, 100)}%` }} /></div>

        <div className="swarm-metrics">
          <div><strong>{total || "—"}</strong><span>agents</span></div>
          <div><strong style={{ color: "var(--green)" }}>{completed}</strong><span>done</span></div>
          <div><strong style={{ color: failed > 0 ? "var(--red)" : undefined }}>{failed}</strong><span>failed</span></div>
        </div>

        <div className="panel-feed-label">live feed</div>
        <div className="swarm-activity">
          {visibleActivity.length === 0 ? (
            <div className="activity-empty">
              <span className="activity-dot" style={{ background: "#1e293b", boxShadow: "none" }} />
              waiting for first signal…
            </div>
          ) : (
            visibleActivity.map((item, i) => (
              <div className="activity-row" data-stage={item.stage} key={`${item.at}-${i}`}>
                <span className="activity-dot" />
                <span className="activity-message">{item.message}</span>
                <span className="activity-time">
                  {new Date(item.at).toLocaleTimeString("en-US", { hour12: false, minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>
    </section>

    {expanded && (
      <NodeFullscreen agent={expanded} onClose={() => setExpanded(null)} />
    )}
  </>
  )
}
