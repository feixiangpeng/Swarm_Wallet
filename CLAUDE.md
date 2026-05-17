# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use the project Node version before running commands:

```bash
source ~/.nvm/nvm.sh
nvm use                 # reads .nvmrc; currently Node 22.13.0
```

### Backend (root)
```bash
npm run check:browserbase  # verify the API key can create a session in BROWSERBASE_PROJECT_ID
npm run smoke          # verify Browserbase + Wafer keys work end-to-end
npm run server         # start WebSocket server on :3001
npm run server:4       # force MAX_BROWSER_SESSIONS=4 and PREWARM_BROWSERBASE_SESSIONS=4
npm run dev:backend    # start server with file watching
```

Fresh local run:

```bash
source ~/.nvm/nvm.sh && nvm use
npm install
npm run check:browserbase
lsof -tiTCP:3001 -sTCP:LISTEN | xargs kill
npm run server
```

To skip the slow prewarm during dev:
```bash
PREWARM_BROWSERBASE=false npm run server
```

### Frontend (`cd frontend`)
```bash
npm run dev            # Next.js dev server on :3000
npm run build          # production build
```

## Architecture

Two independent packages: a Node.js backend in `src/` and a Next.js frontend in `frontend/`. They communicate exclusively over WebSocket.

### Data flow

```
planSwarm() → spawnAgent() × N (concurrent) → runAgent() × N → synthesize()
   Wafer          sessionPool / Browserbase      Stagehand+Wafer    Wafer
```

1. **Planner** (`src/planner.ts`) — single Wafer call, returns N `AgentPlan` objects (site + role + strategy). Qwen3 reasoning models wrap output in `<think>` blocks — strip these before `JSON.parse`.
2. **Config** (`src/config.ts`) — parses all browser concurrency env vars. Blank/invalid values fall back to safe defaults instead of `0`.
3. **Session pool** (`src/sessionPool.ts`) — prewarms Browserbase+Stagehand sessions on server startup. Each warm session takes **10–30s** (Browserbase is provisioning a real remote Chrome VM). The pool fills up to `PREWARM_BROWSERBASE_SESSIONS` (default = `MAX_BROWSER_SESSIONS` = 4) in parallel. Set `PREWARM_BROWSERBASE=false` to skip during dev.
4. **Spawner** (`src/spawner.ts`) — acquires sessions from the pool via `acquireBrowserbaseSession()`. If a warm session is ready it's used instantly; otherwise waits up to `WARM_BROWSERBASE_WAIT_MS` then falls back to a cold create. Failed launches emit `launch_failed` agent updates.
5. **Agents** (`src/agent.ts`) — navigates freely (no semaphore on CDP/navigation), but every `act()` and `extract()` call is gated through `llm.run()` from `src/semaphore.ts`.
6. **Coordinator** (`src/coordinator.ts`) — single Wafer call synthesizing all findings into a `Verdict`.

### Semaphore pattern

`src/semaphore.ts` exports `llm = new Semaphore(3)`. All Wafer LLM calls go through `llm.run(() => ...)`. Browser navigation is always outside the semaphore.

### WebSocket contract

```ts
{ type: "swarm_event",  stage, message, at, agents? }  // lifecycle events
{ type: "agent_update", agentId, site, role, status, replayUrl?, finding? }
{ type: "verdict",      plan, findings, verdict, replayUrls }
```

`agentId` is `"role::site"` (e.g. `"price::amazon.com"`).

Agent statuses in order: `queued` → `launching` → `navigating` → `searching` → `extracting` → `done` | `error` | `launch_failed`.

### Frontend components

| Component | Purpose |
|---|---|
| `SwarmMap.tsx` | SVG node-graph with animated orbits, live iframe nodes, finding cards, fullscreen modal |
| `PriceSpread.tsx` | Live horizontal dot-plot of prices as agents complete — appears as soon as 2+ prices exist |
| `PriceTable.tsx` | Sortable table of all findings (price / confidence / site) — appears after verdict |
| `NodeFullscreen.tsx` | Full-screen modal (960px × 80vh) for any agent's Browserbase replay iframe |
| `Verdict.tsx` | Intelligence report with confidence meter, ranked picks, caution + timing |
| `AgentCard.tsx` / `AgentGrid.tsx` | Detailed replay cards below the map |

`useSwarm.ts` exposes: `agents`, `verdict`, `findings`, `status`, `activity`, `query`, `error`, `search`.

### Landing page sections (idle state)

1. Hero — wordmark, tagline, search bar, hint chips, scroll cue
2. Ticker — scrolling marquee of all supported sites (retail + food)
3. Stats strip — 12+ retailers · < 60s · 1 answer · 0 tabs
4. Before/After — side-by-side comparison table with summary stats
5. Mock dashboard preview — static but accurate preview of the live swarm UI
6. How it works — 4-step timeline with micro-visuals
7. Footer

### Wafer / model config

All LLM calls use `qwen3.6-max-preview` via `baseURL: "https://pass.wafer.ai/v1"`.

Stagehand v3 (`CustomOpenAIClient`) requires `disableAPI: true` — do not remove it. Without it Stagehand routes through its hosted API path and rejects the Wafer key.

Qwen3 produces `<think>...</think>` blocks before JSON output. Strip them before parsing:
```ts
text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```json|```/g, "").trim()
```

### Session pool — why prewarm is slow

Each `session.init()` provisions a real remote Chrome VM on Browserbase with:
- Custom fingerprint (Chrome/macOS/desktop)
- US geolocation proxy
- Captcha solver + ad blocker
- Persistent context (if `BROWSERBASE_CONTEXT_ID` is set)

This takes 10–30s per session and is a Browserbase infrastructure cost — not reducible in code. The pool pays this cost once at startup so searches feel instant. During dev, `PREWARM_BROWSERBASE=false` skips it and sessions are cold-launched per search instead.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `BROWSERBASE_API_KEY` | required | Browserbase auth |
| `BROWSERBASE_PROJECT_ID` | required | Browserbase project |
| `BROWSERBASE_CONTEXT_ID` | optional | Persistent context for cookies/auth |
| `WAFER_API_KEY` | required | Wafer Pass LLM auth |
| `MAX_BROWSER_SESSIONS` | `4` | Max concurrent browser sessions |
| `PREWARM_BROWSERBASE` | `true` | Set `false` to skip startup prewarming |
| `PREWARM_BROWSERBASE_SESSIONS` | `MAX_BROWSER_SESSIONS` | Pool size |
| `WARM_BROWSERBASE_WAIT_MS` | `30000` | Max wait for a warm session before cold-create fallback |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3001` | Frontend WebSocket URL |
| `SNOWFLAKE_ENABLED` | auto | Set `false` to disable; needs account + user + password/key |
| `SNOWFLAKE_ACCOUNT` | — | Account locator (e.g. `xy12345.us-east-1`) |
| `SNOWFLAKE_USER` / `SNOWFLAKE_PASSWORD` | — | Writer creds (or `SNOWFLAKE_PRIVATE_KEY` for JWT) |
| `SNOWFLAKE_WAREHOUSE` | `COMPUTE_WH` | Warehouse for queries |
| `SNOWFLAKE_DATABASE` / `SNOWFLAKE_SCHEMA` | `SWARM_WALLET` / `APP` | Object namespace |

### Snowflake (swarm memory)

- `src/snowflake/` — client, persist, intelligence (price history, outliers, site reliability)
- After each swarm: async writes to `SEARCHES`, `AGENT_EVENTS`, `FINDINGS`, `VERDICTS` (never blocks WS)
- `planSwarm()` re-orders agents by `SITE_RELIABILITY` view when enabled
- `synthesize()` gets SQL-backed `warehouse_insights` on the verdict (shown in `Verdict.tsx`)
- Setup: `npm run snowflake:migrate` · Dashboard: `http://localhost:3000/memory` · API: `GET :3001/snowflake/dashboard`

Do not commit real API keys. `.env.example` has placeholders only.

### Browserbase project checks

`npm run check:browserbase` creates a probe session and releases it immediately. If this fails, the server's prewarm will also fail or be disabled. The server logs effective config on startup:

```
[config] MAX_BROWSER_SESSIONS=4 PREWARM_BROWSERBASE_SESSIONS=4 WARM_BROWSERBASE_WAIT_MS=30000
[prewarm] starting Browserbase session 1/4
[prewarm] Browserbase session ready: <id> (12.4s)
```

### Vercel / WebSocket note

Vercel App Router does not support raw WebSocket upgrades. Deploy `src/server.ts` separately (Railway, Render, Fly.io) and set `NEXT_PUBLIC_WS_URL` to point at it.
