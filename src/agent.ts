import { z } from "zod"
import { llm } from "./semaphore"
import { retireBrowserbaseSession } from "./sessionPool"
import type { LiveAgent } from "./spawner"

const FindingSchema = z.object({
  name: z.string(),
  price: z.number().optional(),
  url: z.string(),
  source: z.string(),
  highlight: z.string(),
  confidence: z.number(),
})

export type Finding = z.infer<typeof FindingSchema>

export type AgentStatus =
  | "queued"
  | "launching"
  | "navigating"
  | "searching"
  | "extracting"
  | "done"
  | "launch_failed"
  | "error"

export interface AgentUpdate {
  agentId: string
  site: string
  role: string
  status: AgentStatus
  currentUrl?: string
  error?: string
  screenshot?: string
  finding?: Finding
  replayUrl?: string
}

function searchUrl(site: string, query: string) {
  const encoded = encodeURIComponent(query)
  const templates: Record<string, string> = {
    "amazon.com": `https://www.amazon.com/s?k=${encoded}`,
    "bestbuy.com": `https://www.bestbuy.com/site/searchpage.jsp?st=${encoded}`,
    "walmart.com": `https://www.walmart.com/search?q=${encoded}`,
    "target.com": `https://www.target.com/s?searchTerm=${encoded}`,
    "newegg.com": `https://www.newegg.com/p/pl?d=${encoded}`,
    "bhphotovideo.com": `https://www.bhphotovideo.com/c/search?Ntt=${encoded}`,
    "adorama.com": `https://www.adorama.com/l/?searchinfo=${encoded}`,
    "ebay.com": `https://www.ebay.com/sch/i.html?_nkw=${encoded}`,
    "slickdeals.net": `https://slickdeals.net/newsearch.php?q=${encoded}`,
    "camelcamelcamel.com": `https://camelcamelcamel.com/search?sq=${encoded}`,
    "reddit.com": `https://www.reddit.com/search/?q=${encoded}`,
    "rtings.com": `https://www.rtings.com/search?q=${encoded}`,
  }

  return templates[site] ?? `https://${site}/search?q=${encoded}`
}

function pageUrl(page: { url?: () => string }) {
  try {
    return page.url?.()
  } catch {
    return undefined
  }
}

async function captureScreenshot(page: unknown) {
  try {
    const buffer = await (page as {
      screenshot: (options: { type: "jpeg"; quality: number; fullPage: boolean }) => Promise<Buffer>
    }).screenshot({ type: "jpeg", quality: 48, fullPage: false })

    return `data:image/jpeg;base64,${buffer.toString("base64")}`
  } catch {
    return undefined
  }
}

export async function runAgent(
  agent: LiveAgent,
  query: string,
  onUpdate: (u: AgentUpdate) => void
): Promise<Finding | null> {
  const { id, plan, session, replayUrl } = agent

  const emit = (status: AgentStatus, extra?: Partial<AgentUpdate>) =>
    onUpdate({ agentId: id, site: plan.site, role: plan.role, status, replayUrl, ...extra })

  try {
    const page = session.context.activePage()!

    // Navigate — no LLM, no semaphore, runs freely
    emit("navigating")
    await page.goto(searchUrl(plan.site, query), { waitUntil: "domcontentloaded", timeoutMs: 45000 })
    emit("navigating", { currentUrl: pageUrl(page), screenshot: await captureScreenshot(page) })

    // Act — LLM calls, queued through semaphore
    emit("searching", { currentUrl: pageUrl(page), screenshot: await captureScreenshot(page) })
    await llm.run(() => session.act(plan.strategy))
    emit("searching", { currentUrl: pageUrl(page), screenshot: await captureScreenshot(page) })

    // Extract — LLM call, queued through semaphore
    emit("extracting", { currentUrl: pageUrl(page), screenshot: await captureScreenshot(page) })
    const finding = await llm.run(() =>
      session.extract(
        `Best result for "${query}": name, price, URL, source, and
         the single most important thing a buyer should know`,
        FindingSchema
      )
    )

    emit("done", { finding, currentUrl: pageUrl(page), screenshot: await captureScreenshot(page) })
    return finding

  } catch (err) {
    emit("error", { error: err instanceof Error ? err.message : String(err) })
    return null
  } finally {
    await session.close()
    retireBrowserbaseSession()
  }
}
