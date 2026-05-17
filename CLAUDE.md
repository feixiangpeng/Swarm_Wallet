# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

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
2. **Spawner** (`src/spawner.ts`) — opens all N Browserbase sessions simultaneously via `Promise.all`. No cap.
3. **Agents** (`src/agent.ts`) — each agent navigates freely (no semaphore), but every `act()` and `extract()` call is gated through `llm.run()` from `src/semaphore.ts`. Agents are unaware of the semaphore.
4. **Coordinator** (`src/coordinator.ts`) — single Wafer call after all agents finish, synthesizes findings into a `Verdict`.

### Semaphore pattern

`src/semaphore.ts` exports a singleton `llm = new Semaphore(3)`. All Wafer LLM calls anywhere in the codebase go through `llm.run(() => ...)`. Browser navigation is always outside the semaphore.

### WebSocket contract

The server (`src/server.ts`) emits two event shapes that `frontend/hooks/useSwarm.ts` consumes:

```ts
{ type: "agent_update", agentId, site, role, status, replayUrl, finding? }
{ type: "verdict", plan, findings, verdict, replayUrls }
```

`agentId` is `"role::site"` (e.g. `"price::amazon.com"`). The frontend keys its agent state map on this.

### Frontend state

`useSwarm.ts` maintains a `Map<agentId, AgentState>` built from streaming `agent_update` events. Each `AgentCard` renders a live Browserbase replay as an `<iframe src={replayUrl}>`.

### Wafer / model config

All LLM calls use `model: "deepseek-v4"` via `baseURL: "https://pass.wafer.ai/v1"`. The OpenAI SDK is used as the client. Stagehand sessions also receive the Wafer base URL and key at session creation time in `src/spawner.ts`.

### Environment variables

- `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID` — used in `src/stagehand.ts`
- `WAFER_API_KEY` — used in `src/planner.ts`, `src/coordinator.ts`, and `src/spawner.ts`
- `NEXT_PUBLIC_WS_URL` — frontend only (default: `ws://localhost:3001`)

### Vercel / WebSocket note

Vercel App Router does not support raw WebSocket upgrades. In production, `src/server.ts` must be deployed separately (Railway, Render, Fly.io) and `NEXT_PUBLIC_WS_URL` pointed at it. `frontend/app/api/swarm/route.ts` is a placeholder.
