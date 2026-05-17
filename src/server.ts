import { createServer } from "http"
import { WebSocketServer } from "ws"
import { swarmSearch, SwarmCancelledError } from "./main"
import { startSessionPrewarm, stopSessionPrewarm } from "./sessionPool"
import { getMaxBrowserSessions, getPrewarmBrowserSessions, getWarmBrowserbaseWaitMs } from "./config"
import { resolveQueryFromUrl } from "./urlMode"

const server = createServer()
const wss = new WebSocketServer({ server })

startSessionPrewarm()

function safeSend(ws: import("ws").WebSocket, payload: unknown) {
  if (ws.readyState !== ws.OPEN) return
  ws.send(JSON.stringify(payload))
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
    try {
      let query = rawQuery ?? ""
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

      const result = await swarmSearch(
        query,
        (update) => safeSend(ws, { type: "agent_update", ...update }),
        (event) => safeSend(ws, { type: "swarm_event", ...event, at: Date.now() }),
        abort.signal,
        { allowedSites },
      )
      safeSend(ws, { type: "verdict", ...result, resolvedQuery: query })
    } catch (err) {
      if (err instanceof SwarmCancelledError) {
        // Client already gone; nothing to send. Just log.
        console.log("swarm cancelled by client")
        return
      }
      safeSend(ws, { type: "error", message: String(err) })
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
})

async function shutdown() {
  await stopSessionPrewarm()
  server.close()
  process.exit(0)
}

process.once("SIGINT", () => void shutdown())
process.once("SIGTERM", () => void shutdown())
