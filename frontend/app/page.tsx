"use client"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { useSwarm } from "@/hooks/useSwarm"
import { useSearchHistory, type HistoryEntry } from "@/hooks/useSearchHistory"
import AgentGrid from "@/components/AgentGrid"
import Verdict from "@/components/Verdict"
import SwarmMap from "@/components/SwarmMap"
import PriceSpread from "@/components/PriceSpread"
import PriceTable from "@/components/PriceTable"
import SearchHistory from "@/components/SearchHistory"
import SourceFilter, { AVAILABLE_SITES, type SiteId } from "@/components/SourceFilter"
import RefineChips from "@/components/RefineChips"
import ConnectSnowflakeButton from "@/components/ConnectSnowflakeButton"

const HINTS = [
  "Sony WH-1000XM5",
  "RTX 5080",
  "vintage Levi 501",
  "standing desk",
  "espresso machine under $400",
  "mechanical keyboard",
]


export default function Home() {
  const [input, setInput]     = useState("")
  const inputRef              = useRef<HTMLInputElement>(null)
  const live = useSwarm()
  const history = useSearchHistory()
  // When non-null, the page renders a saved snapshot in read-only mode
  // instead of the current live swarm state.
  const [snapshot, setSnapshot] = useState<HistoryEntry | null>(null)
  const [selectedSites, setSelectedSites] = useState<SiteId[]>(() => [...AVAILABLE_SITES])

  // When a live swarm finishes successfully, persist it into history.
  useEffect(() => {
    if (live.status !== "done") return
    if (!live.verdict) return
    if (snapshot) return  // restoring a snapshot also flips status to "done"
    const topFinding = live.findings.find(f => f.price != null) ?? live.findings[0]
    history.save({
      query: live.query,
      topPick: topFinding?.source,
      topPrice: topFinding?.price,
      agents: live.agents,
      result: {
        plan: { product: live.query, category: "general", agents: [], reasoning: "" },
        findings: live.findings,
        verdict: live.verdict,
        replayUrls: live.agents.reduce<Record<string, string>>((acc, a) => {
          if (a.replayUrl) acc[a.agentId] = a.replayUrl
          return acc
        }, {}),
      },
    })
    // Intentionally narrow deps: we want exactly one save per completed swarm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.status, live.verdict])

  const isActive = snapshot != null || live.status !== "idle"

  // Resolve which data to render (live swarm OR snapshot).
  const agents   = snapshot ? snapshot.agents : live.agents
  const verdict  = snapshot ? snapshot.result.verdict : live.verdict
  const findings = snapshot ? snapshot.result.findings : live.findings
  const status   = snapshot ? "done" as const : live.status
  const activity = snapshot ? [] : live.activity
  const query    = snapshot ? snapshot.query : live.query
  const error    = snapshot ? null : live.error

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = input.trim()
    if (!q) return
    setSnapshot(null)
    live.search(q, { allowedSites: selectedSites })
  }

  const handleHint = (hint: string) => {
    setInput(hint)
    inputRef.current?.focus()
  }

  const handleSelectSnapshot = (entry: HistoryEntry) => {
    if (live.status === "running") live.cancel()
    setSnapshot(entry)
    setInput(entry.query)
  }

  const agentsDone  = agents.filter(a => a.status === "done").length
  const agentsTotal = agents.length

  const SearchForm = (
    <form
      onSubmit={handleSubmit}
      className={`search-form${isActive ? "" : " hero-form"}`}
    >
      <div className="search-wrap">
        <span className="search-prefix">›</span>
        <input
          ref={inputRef}
          className={`search-input${isActive ? "" : " hero-input"}`}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder='search for anything…'
          disabled={status === "running"}
          autoFocus={!isActive}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <SourceFilter
        selected={selectedSites}
        onChange={setSelectedSites}
        disabled={status === "running"}
      />
      <button
        type="submit"
        className={`search-btn${isActive ? "" : " hero-btn"}`}
        disabled={status === "running" || !input.trim()}
      >
        {status === "running" ? "scanning…" : "run swarm"}
      </button>
    </form>
  )

  if (!isActive) {
    return (
      <div className="app-root">
        {/* ── ABOVE THE FOLD ── */}
        <section className="hero">
          <div className="hero-orb hero-orb-a" aria-hidden />
          <div className="hero-orb hero-orb-b" aria-hidden />

          <div className="hero-content">
            <h1 className="hero-title" aria-label="swarm.wallet">
              <span className="hero-title-word">swarm</span>
              <span className="hero-title-dot">.</span>
              <span className="hero-title-word2">wallet</span>
            </h1>

            <p className="hero-tagline">
              <span className="hero-tagline-line">
                Type any product — electronics, fashion, furniture, gear.
              </span>
              <span className="hero-tagline-line">
                Every relevant site gets searched <em>at once.</em> One answer back.
              </span>
            </p>

            {SearchForm}

            <div className="hero-hints">
              <span className="hero-hints-label">try these →</span>
              {HINTS.map(h => (
                <button key={h} className="hero-hint" onClick={() => handleHint(h)}>
                  {h}
                </button>
              ))}
            </div>

            <ConnectSnowflakeButton variant="hero" />

            <div className="hero-scroll-cue" aria-hidden>
              <span>how it works</span>
              <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                <path d="M6 1v12M1 8l5 6 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </section>

        {/* ── MOCK DASHBOARD PREVIEW ── */}
        <div className="preview-section">
          <p className="how-eyebrow" style={{ textAlign: "center", marginBottom: "1.25rem" }}>live dashboard</p>
          <div className="preview-shell">
            <div className="preview-header">
              <span className="preview-wordmark">swarm<span>.</span>wallet</span>
              <div className="preview-header-right">
                <div className="preview-input-mock"><span>Sony WH-1000XM5</span></div>
                <div className="preview-btn-mock">scanning…</div>
              </div>
            </div>
            <div className="preview-statusbar">
              <span className="preview-status-dot" />
              <span>4/6 agents complete</span>
              <span className="preview-status-sep">·</span>
              <span>Sony WH-1000XM5</span>
            </div>
            <div className="preview-body">
              <div className="preview-graph">
                <svg width="100%" height="100%" className="preview-svg">
                  <circle cx="50%" cy="50%" r="34%" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 8"/>
                  {[0,1,2,3,4,5].map(i => {
                    const angle = -Math.PI/2 + (i/6)*Math.PI*2
                    const cx2 = 50 + Math.cos(angle)*34
                    const cy2 = 50 + Math.sin(angle)*34
                    const colors = ["#f59e0b","#60a5fa","#a78bfa","#34d399","#34d399","#60a5fa"]
                    return <line key={i} x1="50%" y1="50%" x2={`${cx2}%`} y2={`${cy2}%`} stroke={colors[i]} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 5"/>
                  })}
                </svg>
                <div className="preview-core">
                  <div className="preview-core-label">target</div>
                  <div className="preview-core-query">Sony WH-1000XM5</div>
                  <div className="preview-core-stage">scanning</div>
                </div>
                {[
                  { site: "amazon",  status: "done",       price: "$279", color: "#34d399", angle: -90 },
                  { site: "bestbuy", status: "searching",  price: null,   color: "#60a5fa", angle: -30 },
                  { site: "target",  status: "done",       price: "$289", color: "#34d399", angle:  30 },
                  { site: "walmart", status: "extracting", price: null,   color: "#a78bfa", angle:  90 },
                  { site: "ebay",  status: "done",       price: "$259", color: "#34d399", angle: 150 },
                  { site: "etsy",    status: "navigating", price: null,   color: "#f59e0b", angle: 210 },
                ].map(n => {
                  const rad = (n.angle * Math.PI) / 180
                  return (
                    <div
                      key={n.site}
                      className="preview-node"
                      data-status={n.status}
                      style={{
                        left: `${50 + Math.cos(rad) * 34}%`,
                        top:  `${50 + Math.sin(rad) * 34}%`,
                        "--node-color": n.color,
                      } as React.CSSProperties}
                    >
                      {n.price && <span className="preview-node-price">{n.price}</span>}
                      <span className="preview-node-site">{n.site}</span>
                      <span className="preview-node-status" style={{ color: n.color }}>{n.status}</span>
                    </div>
                  )
                })}
              </div>
              <div className="preview-panel">
                <div className="preview-panel-section">
                  {["Launching browsers","Agents scanning","Synthesizing"].map((label, i) => (
                    <div key={label} className={`preview-stage-row${i === 1 ? " active" : i < 1 ? " done" : ""}`}>
                      <div className="preview-stage-dot">{i < 1 ? "✓" : i === 1 ? <span className="preview-stage-pulse"/> : null}</div>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="preview-progress">
                  <div className="preview-progress-bar" style={{ width: "66%" }} />
                </div>
                <div className="preview-metrics">
                  <div><strong>6</strong><span>agents</span></div>
                  <div><strong style={{color:"#34d399"}}>4</strong><span>done</span></div>
                  <div><strong>0</strong><span>failed</span></div>
                </div>
                <div className="preview-feed">
                  {[
                    { msg: "amazon · done",    color: "#34d399" },
                    { msg: "ebay · done",    color: "#34d399" },
                    { msg: "target · done",    color: "#34d399" },
                    { msg: "walmart · extracting", color: "#a78bfa" },
                  ].map((r, i) => (
                    <div key={i} className="preview-feed-row">
                      <span className="preview-feed-dot" style={{ background: r.color }} />
                      <span>{r.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="preview-shimmer-overlay" aria-hidden />
          </div>
        </div>

        {/* ── SNOWFLAKE MEMORY ── */}
        <section className="how-section">
          <div className="how-inner">
            <p className="how-eyebrow">swarm memory</p>
            <h2 className="how-title">Gets smarter every search.</h2>
            <div className="memory-graph-wrap">
              <svg className="memory-graph-svg" viewBox="0 0 560 340" fill="none">
                {/* static lines from outer nodes to semantic core (bottom) */}
                <line x1="100" y1="70" x2="280" y2="280" stroke="#34d399" strokeOpacity="0.2" strokeWidth="1"/>
                <line x1="460" y1="70" x2="280" y2="280" stroke="#60a5fa" strokeOpacity="0.2" strokeWidth="1"/>
                {/* animated dashed flows toward semantic node */}
                <line x1="100" y1="70" x2="280" y2="280" stroke="#34d399" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="5 8"
                  style={{ animation: "memory-dash 1.8s linear infinite" }}/>
                <line x1="460" y1="70" x2="280" y2="280" stroke="#60a5fa" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="5 8"
                  style={{ animation: "memory-dash 1.8s linear infinite 0.6s" }}/>
                {/* orbit ring */}
                <circle cx="280" cy="170" r="140" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 10"/>
              </svg>

              {/* Center core */}
              <div className="memory-core">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="memory-core-snowflake">
                  {/* center */}
                  <circle cx="16" cy="16" r="2" fill="#60a5fa"/>
                  {/* 6 arms */}
                  {[0,60,120,180,240,300].map(deg => {
                    const r = deg * Math.PI / 180
                    const x2 = 16 + Math.cos(r) * 13
                    const y2 = 16 + Math.sin(r) * 13
                    const bx1 = 16 + Math.cos(r) * 7 + Math.cos(r + Math.PI/2) * 4
                    const by1 = 16 + Math.sin(r) * 7 + Math.sin(r + Math.PI/2) * 4
                    const bx2 = 16 + Math.cos(r) * 7 - Math.cos(r + Math.PI/2) * 4
                    const by2 = 16 + Math.sin(r) * 7 - Math.sin(r + Math.PI/2) * 4
                    return (
                      <g key={deg}>
                        <line x1="16" y1="16" x2={x2} y2={y2} stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1={bx1} y1={by1} x2={bx2} y2={by2} stroke="#60a5fa" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.7"/>
                      </g>
                    )
                  })}
                </svg>
                <div className="memory-core-label">memory</div>
              </div>

              {/* Node: price history */}
              <div className="memory-node memory-node-tl">
                <div className="memory-node-dot" style={{ background: "#34d399" }} />
                <div className="memory-node-name">price history</div>
                <div className="memory-node-stat" style={{ color: "#34d399" }}>90-day window</div>
                <div className="memory-node-desc">see if a price is actually a good deal based on history</div>
              </div>

              {/* Node: site reliability */}
              <div className="memory-node memory-node-tr">
                <div className="memory-node-dot" style={{ background: "#60a5fa" }} />
                <div className="memory-node-name">site reliability</div>
                <div className="memory-node-stat" style={{ color: "#60a5fa" }}>30-day rank</div>
                <div className="memory-node-desc">scores every site by success rate — best performers search first</div>
              </div>

              {/* Node: semantic routing */}
              <div className="memory-node memory-node-b">
                <div className="memory-node-dot" style={{ background: "#a78bfa" }} />
                <div className="memory-node-name">semantic routing</div>
                <div className="memory-node-stat" style={{ color: "#a78bfa" }}>vector search</div>
                <div className="memory-node-desc">feeds on past data to route smarter</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="how-section">
          <div className="how-inner">
            <div className="how-steps-simple">
              {[
                { num: "01", label: "Type any product", desc: "No special syntax. Just describe what you want to buy." },
                { num: "02", label: "6 browsers open at once", desc: "Amazon, Best Buy, Target, Walmart, eBay, and Etsy — all searched in parallel, directly, no middleman." },
                { num: "03", label: "One ranked answer", desc: "Prices, availability, and a verdict on where to buy — in under 60 seconds." },
              ].map(step => (
                <div key={step.num} className="how-step-simple">
                  <div className="how-step-simple-num">{step.num}</div>
                  <div className="how-step-simple-label">{step.label}</div>
                  <p className="how-step-simple-desc">{step.desc}</p>
                </div>
              ))}
            </div>
            <div className="how-cta">
              <button className="how-cta-btn" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                try it →
              </button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="site-footer">
          <span className="footer-wordmark">swarm<span>.</span>wallet</span>
          <span className="footer-sep">·</span>
          <span className="footer-tagline">parallel browser agents for purchase intelligence</span>
          <Link className="footer-github" href="/architecture">
            architecture →
          </Link>
          <Link className="footer-github" href="/memory">
            snowflake memory →
          </Link>
          <a
            className="footer-github"
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
          >
            github →
          </a>
        </footer>
      </div>
    )
  }

  return (
    <div className="app-root has-history">
      <SearchHistory
        entries={history.entries}
        activeId={snapshot?.id}
        onSelect={handleSelectSnapshot}
        onRemove={history.remove}
        onClear={history.clear}
      />
      <header className="app-header">
        <div className="header-left">
          <div className="header-wordmark">swarm<span>.</span>wallet</div>
          <ConnectSnowflakeButton variant="header" />
        </div>
        {SearchForm}
      </header>

      <div className="status-bar">
        <div className={`status-indicator ${status}`} />
        <span className="status-bar-count">
          {status === "cancelled"
            ? "cancelled"
            : agentsTotal > 0
            ? `${agentsDone}/${agentsTotal} agents complete`
            : "swarm initializing"}
        </span>
        <span>·</span>
        <span>{query || input}</span>
        {status === "running" && (
          <button type="button" className="status-bar-cancel" onClick={live.cancel}>
            ✕ cancel
          </button>
        )}
      </div>

      {snapshot && (
        <div className="snapshot-banner">
          <span className="snapshot-banner-dot" />
          Viewing a saved search from {new Date(snapshot.ts).toLocaleString()}.
          Replay links may have expired.
          <button
            type="button"
            className="snapshot-banner-exit"
            onClick={() => setSnapshot(null)}
          >
            ← back to live
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="error-banner">
          {error ?? "swarm failed"}
        </div>
      )}

      <main className="main-content">
        <SwarmMap agents={agents} activity={activity} status={status} query={query || input} />
        <PriceSpread agents={agents} />
        {verdict && <Verdict verdict={verdict} findings={findings} />}
        {verdict && (
          <RefineChips
            query={query}
            findings={findings}
            disabled={live.status === "running"}
            onRefine={(nextQuery) => {
              setSnapshot(null)
              setInput(nextQuery)
              live.search(nextQuery, { allowedSites: selectedSites })
            }}
          />
        )}
        {verdict && agents.length > 0 && <PriceTable agents={agents} />}
        {agents.length > 0 && <AgentGrid agents={agents} />}
      </main>
    </div>
  )
}
