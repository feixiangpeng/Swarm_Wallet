"use client"

import { useState, useRef } from "react"
import { useSwarm } from "@/hooks/useSwarm"
import AgentGrid from "@/components/AgentGrid"
import Verdict from "@/components/Verdict"
import SwarmMap from "@/components/SwarmMap"
import PriceSpread from "@/components/PriceSpread"
import PriceTable from "@/components/PriceTable"

const HINTS = [
  "Sony WH-1000XM5",
  "RTX 5080",
  "vintage Levi 501",
  "standing desk",
  "espresso machine under $400",
  "sushi near me",
  "best burger delivery",
  "cheap Chinese food tonight",
]


export default function Home() {
  const [input, setInput]     = useState("")
  const inputRef              = useRef<HTMLInputElement>(null)
  const { agents, verdict, findings, status, activity, query, error, search } = useSwarm()

  const isActive = status !== "idle"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = input.trim()
    if (q) search(q)
  }

  const handleHint = (hint: string) => {
    setInput(hint)
    inputRef.current?.focus()
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
                Type anything — a product, a food craving, a purchase decision.
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

            <div className="hero-scroll-cue" aria-hidden>
              <span>how it works</span>
              <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                <path d="M6 1v12M1 8l5 6 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </section>

        {/* ── TICKER ── */}
        <div className="ticker-wrap" aria-hidden>
          <div className="ticker-track">
            {[
              "amazon", "newegg", "bestbuy", "ebay", "walmart",
              "rtings", "reddit", "slickdeals", "camelcamelcamel",
              "bhphotovideo", "microcenter", "adorama",
              "grailed", "depop", "poshmark", "therealreal",
              "doordash", "uber eats", "grubhub", "yelp",
              "amazon", "newegg", "bestbuy", "ebay", "walmart",
              "rtings", "reddit", "slickdeals", "camelcamelcamel",
              "bhphotovideo", "microcenter", "adorama",
              "grailed", "depop", "poshmark", "therealreal",
              "doordash", "uber eats", "grubhub", "yelp",
            ].map((s, i) => (
              <span key={i} className="ticker-item">{s}</span>
            ))}
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="stats-strip">
          <div className="stat-item">
            <span className="stat-num">12+</span>
            <span className="stat-label">retailers searched</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-num">&lt; 60s</span>
            <span className="stat-label">per full scan</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-num">1</span>
            <span className="stat-label">ranked answer</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-num">0</span>
            <span className="stat-label">tabs opened by you</span>
          </div>
        </div>

        {/* ── BEFORE / AFTER ── */}
        <div className="ba-section">
          <div className="ba-inner">
            <p className="how-eyebrow">the problem</p>
            <h2 className="ba-title">Shopping online is broken.</h2>
            <p className="ba-subtitle">
              You already know the product you want. But finding the actual best deal
              means opening a dozen tabs, manually comparing prices, reading review threads,
              checking price history — and still not knowing if you got it right.
            </p>
            <div className="ba-grid">
              <div className="ba-col ba-col-before">
                <div className="ba-col-header">
                  <span className="ba-col-badge before">before</span>
                  <span className="ba-col-title">Manual search</span>
                </div>
                <div className="ba-rows">
                  {[
                    { metric: "Time spent",        value: "25–45 min", note: "per product research session" },
                    { metric: "Tabs opened",        value: "1–8",       note: "or you just stay on Amazon and hope" },
                    { metric: "Price coverage",     value: "2–3 sites", note: "most people stop at Amazon + Google" },
                    { metric: "Price comparison",   value: "manual",    note: "switching tabs, copy-pasting prices" },
                    { metric: "Deal confidence",    value: "low",       note: "no price history, no context" },
                    { metric: "Review aggregation", value: "manual",    note: "copy-pasting across tabs" },
                    { metric: "Missed savings",     value: "$20–80",    note: "avg. gap between first result and best price" },
                  ].map(r => (
                    <div key={r.metric} className="ba-row">
                      <span className="ba-row-metric">{r.metric}</span>
                      <span className="ba-row-value before">{r.value}</span>
                      <span className="ba-row-note">{r.note}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ba-col ba-col-after">
                <div className="ba-col-header">
                  <span className="ba-col-badge after">after</span>
                  <span className="ba-col-title">Swarm Wallet</span>
                </div>
                <div className="ba-rows">
                  {[
                    { metric: "Time spent",        value: "< 60s",    note: "one query, parallel browser agents" },
                    { metric: "Tabs opened",        value: "0",        note: "you never leave the page" },
                    { metric: "Price coverage",     value: "12+ sites",note: "every relevant retailer at once" },
                    { metric: "Price comparison",   value: "live",     note: "see exact prices across all sites side by side" },
                    { metric: "Deal confidence",    value: "high",     note: "price history + timing advice included" },
                    { metric: "Review aggregation", value: "automatic",note: "synthesized into one verdict" },
                    { metric: "Missed savings",     value: "$0",       note: "best price surfaced in the final ranking" },
                  ].map(r => (
                    <div key={r.metric} className="ba-row">
                      <span className="ba-row-metric">{r.metric}</span>
                      <span className="ba-row-value after">{r.value}</span>
                      <span className="ba-row-note">{r.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="ba-summary">
              <div className="ba-summary-stat">
                <span className="ba-summary-num">97%</span>
                <span className="ba-summary-label">less time spent researching</span>
              </div>
              <div className="ba-summary-divider" />
              <div className="ba-summary-stat">
                <span className="ba-summary-num">6×</span>
                <span className="ba-summary-label">more sites checked per search</span>
              </div>
              <div className="ba-summary-divider" />
              <div className="ba-summary-stat">
                <span className="ba-summary-num">1</span>
                <span className="ba-summary-label">answer instead of 15 tabs</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── MOCK DASHBOARD PREVIEW ── */}
        <div className="preview-section">
          <p className="how-eyebrow" style={{ textAlign: "center", marginBottom: "1.25rem" }}>live dashboard</p>
          <div className="preview-shell">
            {/* fake header */}
            <div className="preview-header">
              <span className="preview-wordmark">swarm<span>.</span>wallet</span>
              <div className="preview-header-right">
                <div className="preview-input-mock">
                  <span>Sony WH-1000XM5</span>
                </div>
                <div className="preview-btn-mock">scanning…</div>
              </div>
            </div>
            {/* fake status bar */}
            <div className="preview-statusbar">
              <span className="preview-status-dot" />
              <span>4/6 agents complete</span>
              <span className="preview-status-sep">·</span>
              <span>Sony WH-1000XM5</span>
            </div>
            {/* fake main area */}
            <div className="preview-body">
              {/* mock graph */}
              <div className="preview-graph">
                <svg width="100%" height="100%" className="preview-svg">
                  {/* orbit ring */}
                  <circle cx="50%" cy="50%" r="34%" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 8"/>
                  {/* connector lines */}
                  {[0,1,2,3,4,5].map(i => {
                    const angle = -Math.PI/2 + (i/6)*Math.PI*2
                    const cx2 = 50 + Math.cos(angle)*34
                    const cy2 = 50 + Math.sin(angle)*34
                    const colors = ["#f59e0b","#60a5fa","#a78bfa","#34d399","#34d399","#60a5fa"]
                    return <line key={i} x1="50%" y1="50%" x2={`${cx2}%`} y2={`${cy2}%`} stroke={colors[i]} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 5"/>
                  })}
                </svg>
                {/* center core */}
                <div className="preview-core">
                  <div className="preview-core-label">target</div>
                  <div className="preview-core-query">Sony WH-1000XM5</div>
                  <div className="preview-core-stage">scanning</div>
                </div>
                {/* orbital nodes */}
                {[
                  { site: "amazon", status: "done",       price: "$279", color: "#34d399", angle: -90 },
                  { site: "bestbuy", status: "searching", price: null,   color: "#60a5fa", angle: -30 },
                  { site: "rtings",  status: "done",      price: null,   color: "#34d399", angle:  30 },
                  { site: "newegg",  status: "extracting",price: null,   color: "#a78bfa", angle:  90 },
                  { site: "reddit",  status: "done",      price: null,   color: "#34d399", angle: 150 },
                  { site: "slickdeals", status: "navigating", price: null, color: "#f59e0b", angle: 210 },
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
              {/* mock panel */}
              <div className="preview-panel">
                <div className="preview-panel-section">
                  {["Planning routes","Launching browsers","Agents scanning","Synthesizing"].map((label, i) => (
                    <div key={label} className={`preview-stage-row${i === 2 ? " active" : i < 2 ? " done" : ""}`}>
                      <div className="preview-stage-dot">{i < 2 ? "✓" : i === 2 ? <span className="preview-stage-pulse"/> : null}</div>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="preview-progress">
                  <div className="preview-progress-bar" style={{ width: "66%" }} />
                </div>
                <div className="preview-metrics">
                  <div><strong>6</strong><span>agents</span></div>
                  <div><strong style={{color:"#34d399"}}>3</strong><span>done</span></div>
                  <div><strong>0</strong><span>failed</span></div>
                </div>
                <div className="preview-feed">
                  {[
                    { msg: "amazon · done", color: "#34d399" },
                    { msg: "rtings · done", color: "#34d399" },
                    { msg: "reddit · done", color: "#34d399" },
                    { msg: "newegg · extracting", color: "#a78bfa" },
                  ].map((r, i) => (
                    <div key={i} className="preview-feed-row">
                      <span className="preview-feed-dot" style={{ background: r.color }} />
                      <span>{r.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* shimmer overlay to make it feel "live" */}
            <div className="preview-shimmer-overlay" aria-hidden />
          </div>
        </div>

        {/* ── HOW IT WORKS ── */}
        <section className="how-section">
          <div className="how-inner">
            <p className="how-eyebrow">under the hood</p>
            <h2 className="how-title">One query. Many browsers. One answer.</h2>

            <div className="how-steps">
              {/* Step 1 */}
              <div className="how-step">
                <div className="how-step-left">
                  <div className="how-step-num">01</div>
                  <div className="how-step-line" />
                </div>
                <div className="how-step-body">
                  <div className="how-step-label">You type a query</div>
                  <p className="how-step-desc">
                    Tell us what you're buying — anything from headphones to vintage jeans. No special syntax needed.
                  </p>
                  <div className="how-step-visual how-visual-query">
                    <span className="how-visual-prefix">›</span>
                    <span className="how-visual-text">Sony WH-1000XM5</span>
                    <span className="how-visual-cursor" />
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="how-step">
                <div className="how-step-left">
                  <div className="how-step-num">02</div>
                  <div className="how-step-line" />
                </div>
                <div className="how-step-body">
                  <div className="how-step-label">The swarm deploys</div>
                  <p className="how-step-desc">
                    Browser sessions open across every retailer, review source, and deal tracker — all at the same time, none waiting for another.
                  </p>
                  <div className="how-step-visual how-visual-swarm">
                    {["amazon", "newegg", "rtings", "reddit", "bestbuy", "slickdeals"].map((s, i) => (
                      <div key={s} className="how-swarm-dot" style={{ animationDelay: `${i * 0.18}s` }}>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="how-step">
                <div className="how-step-left">
                  <div className="how-step-num">03</div>
                  <div className="how-step-line" />
                </div>
                <div className="how-step-body">
                  <div className="how-step-label">Watch it happen live</div>
                  <p className="how-step-desc">
                    Every browser session streams back in real time. You can watch each agent navigate, search, and extract — like a mission control for shopping.
                  </p>
                  <div className="how-step-visual how-visual-cards">
                    {["price::amazon", "reviews::rtings", "deals::reddit"].map((id, i) => (
                      <div key={id} className="how-mini-card" style={{ animationDelay: `${i * 0.2}s` }}>
                        <div className="how-mini-card-bar" />
                        <div className="how-mini-card-lines">
                          <div className="how-mini-line how-mini-line-a" />
                          <div className="how-mini-line how-mini-line-b" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="how-step how-step-last">
                <div className="how-step-left">
                  <div className="how-step-num how-step-num-last">04</div>
                </div>
                <div className="how-step-body">
                  <div className="how-step-label">One verdict</div>
                  <p className="how-step-desc">
                    All findings get synthesized into a single ranked recommendation — best pick, runner-up, one thing to watch out for, and whether to buy now or wait.
                  </p>
                  <div className="how-step-visual how-visual-verdict">
                    <div className="how-verdict-row how-verdict-row-1">
                      <span className="how-verdict-rank">#1</span>
                      <span className="how-verdict-name">Sony WH-1000XM5</span>
                      <span className="how-verdict-price">$279</span>
                    </div>
                    <div className="how-verdict-row how-verdict-row-2">
                      <span className="how-verdict-tag caution">⚠ price drops around holidays</span>
                    </div>
                    <div className="how-verdict-row how-verdict-row-3">
                      <span className="how-verdict-tag timing">◷ buy now — lowest in 6 months</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA at bottom of how-section */}
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
    <div className="app-root">
      <header className="app-header">
        <div className="header-wordmark">swarm<span>.</span>wallet</div>
        {SearchForm}
      </header>

      <div className="status-bar">
        <div className={`status-indicator ${status}`} />
        <span className="status-bar-count">
          {agentsTotal > 0 ? `${agentsDone}/${agentsTotal} agents complete` : "swarm initializing"}
        </span>
        <span>·</span>
        <span>{query || input}</span>
      </div>

      {status === "error" && (
        <div className="error-banner">
          {error ?? "swarm failed"}
        </div>
      )}

      <main className="main-content">
        <SwarmMap agents={agents} activity={activity} status={status} query={query || input} />
        <PriceSpread agents={agents} />
        {verdict && <Verdict verdict={verdict} findings={findings} />}
        {verdict && agents.length > 0 && <PriceTable agents={agents} />}
        {agents.length > 0 && <AgentGrid agents={agents} />}
      </main>
    </div>
  )
}
