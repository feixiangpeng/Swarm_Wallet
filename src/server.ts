import { createServer, type IncomingMessage, type ServerResponse } from "http"
import { WebSocketServer } from "ws"
import { swarmSearch, SwarmCancelledError } from "./main"
import { startSessionPrewarm, stopSessionPrewarm } from "./sessionPool"
import {
  getExtractTimeoutMs,
  getFastBrowserbaseSessions,
  getLlmConcurrency,
  getMaxBrowserSessions,
} from "./config"
import { resolveQueryFromUrl } from "./urlMode"
import {
  isSnowflakeEnabled,
  recordAgentEvent,
  recordSearchStart,
  persistSearchComplete,
  persistSearchError,
  snowflakeAsync,
  fetchSnowflakeDashboard,
  isSemanticSearchEnabled,
} from "./snowflake/index"

const server = createServer(handleHttp)
const wss = new WebSocketServer({ server })

startSessionPrewarm()

function safeSend(ws: import("ws").WebSocket, payload: unknown) {
  if (ws.readyState !== ws.OPEN) return
  ws.send(JSON.stringify(payload))
}

async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = req.url?.split("?")[0] ?? "/"
  setCors(res)

  if (req.method === "OPTIONS") {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method === "GET" && url === "/health") {
    json(res, 200, {
      ok: true,
      snowflake: isSnowflakeEnabled(),
      semantic_search: isSemanticSearchEnabled(),
    })
    return
  }

  if (req.method === "GET" && (url === "/snowflake/dashboard" || url === "/snowflake/stats")) {
    if (!isSnowflakeEnabled()) {
      json(res, 503, { error: "Snowflake not configured" })
      return
    }
    try {
      const dashboard = await fetchSnowflakeDashboard()
      if (url === "/snowflake/stats") {
        json(res, 200, {
          searches: dashboard.summary.searches,
          priced_findings: dashboard.summary.priced_findings,
          recent: dashboard.recent_searches,
        })
        return
      }
      json(res, 200, dashboard)
    } catch (err) {
      json(res, 500, { error: String(err) })
    }
    return
  }

  res.statusCode = 404
  res.end()
}

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
}

wss.on("connection", (ws) => {
  // One AbortController per connection — fires when the client disconnects
  // (cancel button, tab close, refresh) so swarmSearch stops queuing new work.
  const abort = new AbortController()
  ws.on("close", () => abort.abort())

  ws.on("message", async (data) => {
    const payload = JSON.parse(data.toString())
    const { query: rawQuery, allowedSites, mode, url } = payload as {
      query?: string
      allowedSites?: string[]
      mode?: "url" | "text"
      url?: string
    }
    const searchId = crypto.randomUUID()
    const startedAt = Date.now()
    let query = rawQuery ?? ""

    try {
      if (mode === "url" && url) {
        safeSend(ws, {
          type: "swarm_event",
          stage: "planning",
          message: `extracting product info from ${new URL(url).host}…`,
          at: Date.now(),
        })
        query = await resolveQueryFromUrl(url)
        safeSend(ws, {
          type: "swarm_event",
          stage: "planning",
          message: `searching for: ${query}`,
          resolvedQuery: query,
          at: Date.now(),
        })
        if (abort.signal.aborted) return
      }

      snowflakeAsync("recordSearchStart", () =>
        recordSearchStart(searchId, query, "general")
      )

      const result = await swarmSearch(
        query,
        (update) => {
          safeSend(ws, { type: "agent_update", ...update })
          snowflakeAsync("recordAgentEvent", () =>
            recordAgentEvent(searchId, update)
          )
        },
        (event) => safeSend(ws, { type: "swarm_event", ...event, at: Date.now() }),
        abort.signal,
        { allowedSites, searchId },
      )

      safeSend(ws, {
        type: "verdict",
        searchId: result.searchId,
        plan: result.plan,
        findings: result.findings,
        verdict: result.verdict,
        replayUrls: result.replayUrls,
        resolvedQuery: query,
      })

      snowflakeAsync("persistSearchComplete", () =>
        persistSearchComplete({
          searchId: result.searchId,
          query,
          plan: result.plan,
          findingRows: result.findingRows,
          verdict: result.verdict,
          replayUrls: result.replayUrls,
          startedAt: result.startedAt,
          outliers: result.verdict.warehouse_insights?.outliers ?? [],
        })
      )
    } catch (err) {
      if (err instanceof SwarmCancelledError) {
        // Client already gone; nothing to send. Just log.
        console.log("swarm cancelled by client")
        return
      }
      const message = String(err)
      safeSend(ws, { type: "error", message })
      snowflakeAsync("persistSearchError", () =>
        persistSearchError(searchId, query, message, startedAt)
      )
    }
  })
})

server.listen(3001, () => {
  console.log("WS server ready on :3001")
  console.log(
    `[config] MAX_BROWSER_SESSIONS=${getMaxBrowserSessions()} ` +
    `LLM_CONCURRENCY=${getLlmConcurrency()} ` +
    `EXTRACT_TIMEOUT_MS=${getExtractTimeoutMs()} ` +
    `BROWSERBASE_FAST_SESSIONS=${getFastBrowserbaseSessions()}`
  )
  console.log(`[snowflake] ${isSnowflakeEnabled() ? "enabled" : "disabled"}`)
})

async function shutdown() {
  await stopSessionPrewarm()
  server.close()
  process.exit(0)
}

process.once("SIGINT", () => void shutdown())
process.once("SIGTERM", () => void shutdown())
