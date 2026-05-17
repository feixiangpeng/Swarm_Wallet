# Swarm Wallet

AI-powered purchase intelligence. A swarm of browser agents scrapes every
relevant retailer in parallel and synthesizes a ranked recommendation.

## Stack

| Layer | Tech |
|---|---|
| Browsers | Browserbase + Stagehand |
| Model | Wafer Pass (planner, agents, coordinator) |
| LLM concurrency | `Semaphore(3)` gates all Wafer calls |
| Backend | Node.js + WebSocket (`ws`) |
| Frontend | Next.js + Vercel |

---

## Ownership split

```
swarm-wallet/
├── src/               ← BACKEND (you)
│   ├── semaphore.ts   — LLM concurrency gate
│   ├── stagehand.ts   — shared Browserbase instance
│   ├── planner.ts     — Wafer decides which agents to spawn
│   ├── spawner.ts     — opens all browser sessions simultaneously
│   ├── agent.ts       — each agent drives its browser + emits updates
│   ├── coordinator.ts — Wafer synthesizes findings into a verdict
│   ├── main.ts        — orchestrates the full loop
│   └── server.ts      — WebSocket server (port 3001)
│
└── frontend/          ← FRONTEND (partner)
    ├── app/
    │   ├── page.tsx           — search input + layout
    │   └── api/swarm/route.ts — WebSocket upgrade (Vercel TODO)
    ├── components/
    │   ├── AgentGrid.tsx      — responsive grid of agent cards
    │   ├── AgentCard.tsx      — live status + Browserbase replay iframe
    │   └── Verdict.tsx        — final recommendation panel
    └── hooks/
        └── useSwarm.ts        — WebSocket state management
```

**Contract between backend and frontend** — the server emits two event shapes:

```ts
// while agents run (many)
{ type: "agent_update", agentId, site, role, status, replayUrl, finding? }

// once all agents finish (one)
{ type: "verdict", plan, findings, verdict, replayUrls }
```

`useSwarm.ts` consumes these. Neither side needs to know the other's internals.

---

## Setup

### Keys

Copy `.env.example` to `.env` and fill in:

```
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=...
WAFER_API_KEY=...
```

### Backend

```bash
npm install
npm run smoke        # verify keys work
npm run server       # start WS server on :3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # Next.js on :3000
```

Set `NEXT_PUBLIC_WS_URL=ws://localhost:3001` in `frontend/.env.local` for local dev.

### Snowflake (swarm memory)

Snowflake stores every swarm run and powers:

- **90-day price history** → grounded “buy now or wait” timing in the verdict
- **Outlier detection** → flags suspiciously cheap listings vs history
- **Site reliability** → re-ranks which agents to deploy first
- **Collective intelligence** → “best historical site” hints across prior swarms
- **Memory dashboard** → Next.js page at `/memory` (live warehouse stats)

```bash
# Add SNOWFLAKE_* vars to .env (see .env.example)
npm run snowflake:migrate   # creates tables, views, dynamic table

npm run server              # logs [snowflake] enabled when configured
cd frontend && npm run dev  # open http://localhost:3000/memory
```

API: `GET http://localhost:3001/snowflake/dashboard` (proxied via `frontend/app/api/snowflake/dashboard`)

Without Snowflake credentials the app runs normally; persistence and warehouse insights are skipped.

---

## Build order

1. `smoke.ts` — one browser, one extract. Keys good? Move on.
2. `src/planner.ts` — test a few queries, check site lists.
3. `src/semaphore.ts` — already done, copy in.
4. `src/spawner.ts` + `src/agent.ts` — one agent, one site, log the finding.
5. `src/main.ts` — full swarm, watch logs interleave.
6. `src/server.ts` — connect from browser console via WebSocket.
7. Frontend — agent cards + replay iframes, then verdict.
8. `src/coordinator.ts` — wire in last once agents are solid.

---

## WebSocket (Vercel note)

Vercel App Router doesn't support raw WS upgrades. For production, deploy
`src/server.ts` separately (Railway, Render, Fly.io) and set
`NEXT_PUBLIC_WS_URL` to point at it.
