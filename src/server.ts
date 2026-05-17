import { createServer } from "http"
import { WebSocketServer } from "ws"
import { swarmSearch } from "./main"

const server = createServer()
const wss = new WebSocketServer({ server })

wss.on("connection", (ws) => {
  ws.on("message", async (data) => {
    const { query } = JSON.parse(data.toString())
    try {
      const result = await swarmSearch(query, (update) => {
        ws.send(JSON.stringify({ type: "agent_update", ...update }))
      })
      ws.send(JSON.stringify({ type: "verdict", ...result }))
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: String(err) }))
    }
  })
})

server.listen(3001, () => console.log("WS server ready on :3001"))
