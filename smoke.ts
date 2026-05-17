import { createBrowserbaseSession } from "./src/stagehand"
import { z } from "zod"

const session = createBrowserbaseSession()
await session.init()

console.log("Session ID:", session.browserbaseSessionID)

const page = session.context.activePage()!
const html = `
  <main>
    <label for="search">Search products</label>
    <input id="search" name="search" />
    <button type="button">Search</button>
    <section aria-label="Search results">
      <article>
        <h2>Sony WH-1000XM5 Wireless Noise Canceling Headphones</h2>
        <p>$328.00</p>
      </article>
    </section>
  </main>
`

await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

await session.act(`type "Sony WH-1000XM5" into the search input`)

const result = await session.extract(
  "get the name and price of the first result",
  z.object({ name: z.string(), price: z.string() })
)

console.log(result)
await session.close()
