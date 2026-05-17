"use client"

import { useState, useRef } from "react"
import { useSwarm } from "@/hooks/useSwarm"
import AgentGrid from "@/components/AgentGrid"
import Verdict from "@/components/Verdict"

const HINTS = [
  "Sony WH-1000XM5",
  "RTX 5080",
  "vintage Levi 501",
  "standing desk",
  "espresso machine under $400",
]

export default function Home() {
  const [input, setInput]     = useState("")
  const inputRef              = useRef<HTMLInputElement>(null)
  const { agents, verdict, status, search } = useSwarm()

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
        <main className="hero">
          <div className="hero-wordmark" aria-hidden>
            swarm<span>.</span>wallet
          </div>
          <p className="hero-subtitle">parallel browser agents · live intelligence · ranked verdicts</p>
          {SearchForm}
          <div className="hero-hints">
            {HINTS.map(h => (
              <button key={h} className="hero-hint" onClick={() => handleHint(h)}>
                {h}
              </button>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="header-wordmark">swarm<span>.</span>wallet</div>
        {SearchForm}
      </header>

      {agentsTotal > 0 && (
        <div className="status-bar">
          <div className={`status-indicator ${status}`} />
          <span className="status-bar-count">
            {agentsDone}/{agentsTotal} agents complete
          </span>
          <span>·</span>
          <span>{input}</span>
        </div>
      )}

      {status === "error" && (
        <div className="error-banner">
          connection error — is the backend running on :3001?
        </div>
      )}

      <main className="main-content">
        {verdict && <Verdict verdict={verdict} />}
        {agents.length > 0 && <AgentGrid agents={agents} />}
      </main>
    </div>
  )
}
