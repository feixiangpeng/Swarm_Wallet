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
npm run smoke          # verify Browserbase + Wafer keys work end-to-end
npm run server         # start WebSocket server on :3001
npm run dev:backend    # start server with file watching
```

### Frontend (`cd frontend`)
```bash
npm run dev            # Next.js dev server on :3000
npm run build          # production build
```

## Architecture

The system has two independent packages: a Node.js backend in `src/` and a Next.js frontend in `frontend/`. They communicate exclusively over WebSocket.

### Data flow

```
planSwarm() → spawnAgents() → runAgent() × N (parallel) → synthesize()
   Wafer          Browserbase      Stagehand + Wafer           Wafer
```

1. **Planner** (`src/planner.ts`) — single Wafer call, returns N `AgentPlan` objects (site + role + strategy string).
2. **Session pool** (`src/sessionPool.ts`) — prewarms Browserbase + Stagehand sessions as soon as `src/server.ts` starts. The pool target defaults to `MAX_BROWSER_SESSIONS` (`4`) and can be overridden with `PREWARM_BROWSERBASE_SESSIONS`.
3. **Spawner** (`src/spawner.ts`) — acquires warmed sessions from the pool and assigns each one to an `AgentPlan`. Failed launches emit `launch_failed` agent updates instead of silently disappearing.
4. **Agents** (`src/agent.ts`) — each agent navigates freely (no semaphore), but every `act()` and `extract()` call is gated through `llm.run()` from `src/semaphore.ts`. Agents are unaware of the semaphore.
5. **Coordinator** (`src/coordinator.ts`) — single Wafer call after all agents finish, synthesizes findings into a `Verdict`.

### Semaphore pattern

`src/semaphore.ts` exports a singleton `llm = new Semaphore(3)`. All Wafer LLM calls anywhere in the codebase go through `llm.run(() => ...)`. Browser navigation is always outside the semaphore.

### WebSocket contract

The server (`src/server.ts`) emits three event shapes that `frontend/hooks/useSwarm.ts` consumes:

```ts
{ type: "swarm_event", stage, message, at }
{ type: "agent_update", agentId, site, role, status, replayUrl, finding? }
{ type: "verdict", plan, findings, verdict, replayUrls }
```

`swarm_event` drives the scanning UI lifecycle (`planning`, `spawning`, `running`, `synthesizing`, `complete`).
`agentId` is `"role::site"` (e.g. `"price::amazon.com"`). The frontend keys its agent state map on this.

### Frontend state

`useSwarm.ts` maintains streaming agent state, scan activity, the active query, verdict state, and user-facing errors.

The active/running UI is centered on `frontend/components/SwarmMap.tsx`, which renders:

- a central target bubble with the query and current stage
- placeholder planning bubbles before agents exist
- live agent bubbles once `agent_update` events arrive
- live screenshots from the Browserbase page when agents navigate/search/extract
- a telemetry panel with progress, counts, and recent activity

`AgentGrid` / `AgentCard` still render detailed Browserbase replay cards below the map once agents exist.

### Wafer / model config

Planner and coordinator calls use the OpenAI SDK against Wafer:

```ts
model: "qwen3.6-max-preview"
baseURL: "https://pass.wafer.ai/v1"
```

Stagehand v3 requires provider/model naming for built-in AI SDK clients, but Wafer is OpenAI-chat-compatible and does not support the `/responses` endpoint used by Stagehand's AI SDK OpenAI path. `src/stagehand.ts` therefore creates a `CustomOpenAIClient` with:

```ts
modelName: "qwen3.6-max-preview"
baseURL: "https://pass.wafer.ai/v1"
disableAPI: true
```

Do not remove `disableAPI: true`; otherwise Stagehand may route through its hosted API/OpenAI provider path and reject the Wafer key or hit the wrong endpoint.

`src/setup-context.ts` creates a persistent Browserbase context and prints a live setup URL. Run `npm run setup:context`, log into any sites that should persist cookies, then add the printed `BROWSERBASE_CONTEXT_ID` to `.env`. `src/stagehand.ts` reuses that context for future sessions when present.

### Environment variables

- `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID` — used in `src/stagehand.ts`
- `BROWSERBASE_CONTEXT_ID` — optional persistent Browserbase context for cookies/auth
- `WAFER_API_KEY` — used in `src/planner.ts`, `src/coordinator.ts`, and `src/stagehand.ts`
- `MAX_BROWSER_SESSIONS` — optional backend concurrency for Browserbase sessions; default `4`
- `PREWARM_BROWSERBASE` — set to `false` to disable startup prewarming
- `PREWARM_BROWSERBASE_SESSIONS` — optional prewarm pool size; defaults to `MAX_BROWSER_SESSIONS`
- `NEXT_PUBLIC_WS_URL` — frontend only (default: `ws://localhost:3001`)

Do not commit real API keys. `.env.example` should contain placeholders only.

### Vercel / WebSocket note

Vercel App Router does not support raw WebSocket upgrades. In production, `src/server.ts` must be deployed separately (Railway, Render, Fly.io) and `NEXT_PUBLIC_WS_URL` pointed at it. `frontend/app/api/swarm/route.ts` is a placeholder.
