import { createServer, type IncomingMessage, type ServerResponse } from "http"
import { WebSocketServer } from "ws"
import { swarmSearch } from "./main"
import { startSessionPrewarm, stopSessionPrewarm } from "./sessionPool"
import { getMaxBrowserSessions, getPrewarmBrowserSessions, getWarmBrowserbaseWaitMs } from "./config"
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
  ws.on("message", async (data) => {
    const { query } = JSON.parse(data.toString())
    const searchId = crypto.randomUUID()
    const startedAt = Date.now()

    snowflakeAsync("recordSearchStart", () =>
      recordSearchStart(searchId, query, "general")
    )

    try {
      const result = await swarmSearch(
        query,
        (update) => {
          ws.send(JSON.stringify({ type: "agent_update", ...update }))
          snowflakeAsync("recordAgentEvent", () =>
            recordAgentEvent(searchId, update)
          )
        },
        (event) => {
          ws.send(JSON.stringify({ type: "swarm_event", ...event, at: Date.now() }))
        },
        { searchId }
      )

      ws.send(
        JSON.stringify({
          type: "verdict",
          searchId: result.searchId,
          plan: result.plan,
          findings: result.findings,
          verdict: result.verdict,
          replayUrls: result.replayUrls,
        })
      )

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
      const message = String(err)
      ws.send(JSON.stringify({ type: "error", message }))
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
    `PREWARM_BROWSERBASE_SESSIONS=${getPrewarmBrowserSessions()} ` +
    `WARM_BROWSERBASE_WAIT_MS=${getWarmBrowserbaseWaitMs()}`
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
