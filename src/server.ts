import { createServer } from "http"
import { WebSocketServer } from "ws"
import { swarmSearch } from "./main"
import { startSessionPrewarm, stopSessionPrewarm } from "./sessionPool"
import { getMaxBrowserSessions, getPrewarmBrowserSessions, getWarmBrowserbaseWaitMs } from "./config"

const server = createServer()
const wss = new WebSocketServer({ server })

startSessionPrewarm()

wss.on("connection", (ws) => {
  ws.on("message", async (data) => {
    const { query } = JSON.parse(data.toString())
    try {
      const result = await swarmSearch(query, (update) => {
        ws.send(JSON.stringify({ type: "agent_update", ...update }))
      }, (event) => {
        ws.send(JSON.stringify({ type: "swarm_event", ...event, at: Date.now() }))
      })
      ws.send(JSON.stringify({ type: "verdict", ...result }))
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: String(err) }))
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
