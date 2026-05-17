"use client"

import Link from "next/link"

const STACK = [
  { label: "Frontend", value: "Next.js · :3000 · WebSocket client" },
  { label: "Backend", value: "Node · :3001 · swarmSearch orchestrator" },
  { label: "Browsers", value: "Browserbase + Stagehand · remote Chrome" },
  { label: "LLM", value: "Wafer Pass · qwen3.6-max-preview" },
  { label: "Memory", value: "Snowflake · Cortex vectors · SQL analytics" },
]

const SWARM_STEPS = [
  {
    phase: "1 · connect",
    title: "User submits a query",
    body: "Homepage or URL mode sends a message over WebSocket to the backend. Optional site filter narrows the retailer set.",
    tags: ["Next.js", "WebSocket"],
  },
  {
    phase: "2 · plan",
    title: "Planner picks agents & sites",
    body: "Default popular retailers, re-ordered by Snowflake. When semantic memory exists, Cortex embeds the query and routes only to sites that priced well on similar past swarms.",
    tags: ["planSwarm", "Cortex", "SITE_RELIABILITY"],
  },
  {
    phase: "3 · run",
    title: "Parallel browser agents",
    body: "Up to MAX_BROWSER_SESSIONS Browserbase VMs launch at once. Each agent navigates, searches, and extracts via Stagehand act/extract (LLM calls gated by a semaphore). Live replay URLs stream to the swarm map.",
    tags: ["Browserbase", "Stagehand", "session pool"],
  },
  {
    phase: "4 · remember (read)",
    title: "Snowflake intelligence before verdict",
    body: "Exact product_key history, semantic similar queries, 90-day price stats, outliers, and site hints are assembled into warehouse_insights for the coordinator.",
    tags: ["buildIntelligenceContext", "VECTOR_COSINE_SIMILARITY"],
  },
  {
    phase: "5 · synthesize",
    title: "Wafer produces the verdict",
    body: "One LLM call merges live findings with warehouse facts into recommendation, timing, top picks, and caution — shown in the Verdict card.",
    tags: ["synthesize", "Verdict.tsx"],
  },
  {
    phase: "6 · persist (write)",
    title: "Async write + embed for next time",
    body: "SEARCHES, FINDINGS, VERDICTS, and AGENT_EVENTS land in Snowflake. Cortex writes QUERY_EMBEDDING (768-dim) so the next swarm can match different wording.",
    tags: ["persistSearchComplete", "embedCompletedSearch"],
  },
]

const MEMORY_READS = [
  {
    when: "Before agents",
    what: "Semantic site routing — which retailers to open",
    path: "findSitesFromSimilarSearches → getPlannerSiteBoost",
  },
  {
    when: "After agents",
    what: "Price history, outliers, similar queries for verdict",
    path: "buildIntelligenceContext → synthesize",
  },
]

function FlowArrow() {
  return (
    <div className="arch-flow-arrow" aria-hidden>
      <span className="arch-flow-arrow-line" />
      <span className="arch-flow-arrow-head">↓</span>
    </div>
  )
}

export default function ArchitecturePage() {
  return (
    <div className="arch-root">
      <header className="arch-header">
        <Link href="/" className="memory-back">
          ← swarm.wallet
        </Link>
        <h1 className="arch-title">
          swarm<span>.</span>architecture
        </h1>
        <p className="arch-subtitle">
          How a single search moves through browsers, LLMs, and Snowflake collective memory.
        </p>
        <nav className="arch-nav">
          <Link href="/" className="arch-nav-link">
            home
          </Link>
          <Link href="/memory" className="arch-nav-link">
            memory →
          </Link>
        </nav>
      </header>

      <section className="arch-section">
        <h2 className="arch-section-title">System overview</h2>
        <div className="arch-system">
          <div className="arch-system-row arch-system-row-top">
            <div className="arch-node arch-node-user">
              <span className="arch-node-label">You</span>
              <span className="arch-node-desc">search query</span>
            </div>
          </div>
          <div className="arch-system-connector arch-system-connector-down" />
          <div className="arch-system-row">
            <div className="arch-node arch-node-fe">
              <span className="arch-node-label">Frontend</span>
              <span className="arch-node-desc">Next.js :3000</span>
            </div>
            <span className="arch-system-h">WS</span>
            <div className="arch-node arch-node-be">
              <span className="arch-node-label">Backend</span>
              <span className="arch-node-desc">Node :3001</span>
            </div>
          </div>
          <div className="arch-system-connector arch-system-connector-fan">
            <span />
            <span />
            <span />
          </div>
          <div className="arch-system-row arch-system-row-three">
            <div className="arch-node">
              <span className="arch-node-label">Browserbase</span>
              <span className="arch-node-desc">N remote Chromes</span>
            </div>
            <div className="arch-node arch-node-wafer">
              <span className="arch-node-label">Wafer</span>
              <span className="arch-node-desc">plan + synthesize</span>
            </div>
            <div className="arch-node arch-node-snow">
              <span className="arch-node-label">Snowflake</span>
              <span className="arch-node-desc">memory + vectors</span>
            </div>
          </div>
        </div>
      </section>

      <section className="arch-section">
        <h2 className="arch-section-title">One swarm, end to end</h2>
        <ol className="arch-flow">
          {SWARM_STEPS.map((step, i) => (
            <li key={step.phase} className="arch-flow-step">
              <div className="arch-flow-card">
                <span className="arch-flow-phase">{step.phase}</span>
                <h3 className="arch-flow-title">{step.title}</h3>
                <p className="arch-flow-body">{step.body}</p>
                <ul className="arch-flow-tags">
                  {step.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              {i < SWARM_STEPS.length - 1 && <FlowArrow />}
            </li>
          ))}
        </ol>
      </section>

      <section className="arch-section">
        <h2 className="arch-section-title">Snowflake memory (two reads, one write)</h2>
        <p className="arch-section-lead">
          Vectors live in <code>SEARCHES.QUERY_EMBEDDING</code> — not a separate vector DB. Semantic
          search uses <code>SNOWFLAKE.CORTEX.EMBED_TEXT_768</code> and{" "}
          <code>VECTOR_COSINE_SIMILARITY</code>.
        </p>
        <div className="arch-memory-grid">
          {MEMORY_READS.map((r) => (
            <article key={r.when} className="arch-memory-card">
              <span className="arch-memory-when">{r.when}</span>
              <h3 className="arch-memory-what">{r.what}</h3>
              <code className="arch-memory-path">{r.path}</code>
            </article>
          ))}
          <article className="arch-memory-card arch-memory-card-write">
            <span className="arch-memory-when">After verdict</span>
            <h3 className="arch-memory-what">Persist rows + embed query & findings</h3>
            <code className="arch-memory-path">persistSearchComplete → embedCompletedSearch</code>
          </article>
        </div>
        <div className="arch-semantic-loop">
          <span className="arch-semantic-loop-label">Second search payoff</span>
          <p>
            Run 1 embeds → Run 2 with different wording matches via semantic memory → planner
            routes fewer, better sites → verdict shows similar queries & 90d stats on{" "}
            <Link href="/memory">/memory</Link>.
          </p>
        </div>
      </section>

      <section className="arch-section">
        <h2 className="arch-section-title">Concurrency & guardrails</h2>
        <ul className="arch-bullets">
          <li>
            <strong>Browser cap</strong> — <code>MAX_BROWSER_SESSIONS</code> (default 4); session pool
            prewarms VMs on startup.
          </li>
          <li>
            <strong>LLM cap</strong> — semaphore of 3 for all Wafer / Stagehand LLM calls; navigation
            is never blocked.
          </li>
          <li>
            <strong>Snowflake</strong> — all writes are fire-and-forget; never block the WebSocket
            swarm.
          </li>
          <li>
            <strong>Auth</strong> — JWT key-pair to Snowflake (<code>TRAINING_ROLE</code> on edu
            accounts); Cortex for embeddings.
          </li>
        </ul>
      </section>

      <section className="arch-section">
        <h2 className="arch-section-title">Stack</h2>
        <dl className="arch-stack">
          {STACK.map((row) => (
            <div key={row.label} className="arch-stack-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="arch-footer">
        <Link href="/">← back to search</Link>
        <Link href="/memory">open memory dashboard →</Link>
      </footer>
    </div>
  )
}
