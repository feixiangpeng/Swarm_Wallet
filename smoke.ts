import { createBrowserbaseSession } from "./src/stagehand"
import { z } from "zod"

const session = createBrowserbaseSession()
await session.init()

console.log("Session ID:", session.browserbaseSessionID)

await session.context.activePage()!.goto("https://amazon.com")
await session.act(`search for "Sony WH-1000XM5"`)

const result = await session.extract(
  "get the name and price of the first result",
  z.object({ name: z.string(), price: z.string() })
)

console.log(result)
await session.close()
