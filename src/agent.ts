import { z } from "zod"
import { llm } from "./semaphore"
import { getExtractTimeoutMs } from "./config"
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

const EXTRACT_IGNORE_SELECTORS = [
  "header",
  "nav",
  "footer",
  "aside",
  "[role='banner']",
  "[role='navigation']",
  "[role='contentinfo']",
  "[aria-label*='Sponsored']",
  "[aria-label*='Advertisement']",
]

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
  const etsySlug = query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "shopping"
  const templates: Record<string, string> = {
    "amazon.com": `https://www.amazon.com/s?k=${encoded}`,
    "bestbuy.com": `https://www.bestbuy.com/site/searchpage.jsp?st=${encoded}`,
    "walmart.com": `https://www.walmart.com/search?q=${encoded}`,
    "target.com": `https://www.target.com/s?searchTerm=${encoded}`,
    "newegg.com": `https://www.newegg.com/p/pl?d=${encoded}`,
    "bhphotovideo.com": `https://www.bhphotovideo.com/c/search?Ntt=${encoded}`,
    "adorama.com": `https://www.adorama.com/l/?searchinfo=${encoded}`,
    "ebay.com": `https://www.ebay.com/sch/i.html?_nkw=${encoded}&LH_BIN=1&_sop=15&rt=nc&_ipg=60`,
    "etsy.com": `https://www.etsy.com/market/${etsySlug}`,
    "slickdeals.net": `https://slickdeals.net/newsearch.php?q=${encoded}`,
    "camelcamelcamel.com": `https://camelcamelcamel.com/search?sq=${encoded}`,
    "reddit.com": `https://www.reddit.com/search/?q=${encoded}`,
    "rtings.com": `https://www.rtings.com/search?q=${encoded}`,
  }

  return templates[site] ?? `https://${site}/search?q=${encoded}`
}

const PAGE_WAIT_MS: Record<string, number> = {
  "amazon.com": 2500,
  "bestbuy.com": 3000,
  "walmart.com": 4000,
  "target.com": 3000,
  "newegg.com": 3000,
  "bhphotovideo.com": 3000,
  "adorama.com": 3000,
  "ebay.com": 3000,
  "etsy.com": 3500,
  "slickdeals.net": 2500,
  "camelcamelcamel.com": 3000,
  "reddit.com": 2500,
  "rtings.com": 3000,
}

function pageWaitMs(site: string) {
  return PAGE_WAIT_MS[site] ?? 3000
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

async function waitForPage(page: unknown, ms: number) {
  await (page as { waitForTimeout: (ms: number) => Promise<void> }).waitForTimeout(ms)
}

async function navigateFast(page: unknown, url: string) {
  try {
    await (page as {
      evaluate: <R = unknown, Arg = unknown>(
        pageFunctionOrExpression: string | ((arg: Arg) => R | Promise<R>),
        arg?: Arg
      ) => Promise<R>
    }).evaluate((targetUrl: string) => {
      window.location.assign(targetUrl)
    }, url)
  } catch {
    await (page as {
      goto: (url: string, options: { waitUntil: "domcontentloaded"; timeoutMs: number }) => Promise<unknown>
    }).goto(url, { waitUntil: "domcontentloaded", timeoutMs: 12_000 })
  }
}

async function dismissCommonOverlays(page: unknown) {
  try {
    await (page as { evaluate: (fn: () => void) => Promise<unknown> }).evaluate(() => {
      const labels = ["accept all", "accept", "agree", "i agree", "got it", "allow all", "continue"]
      const nodes = Array.from(document.querySelectorAll("button, a, [role='button']"))
      for (const label of labels) {
        const hit = nodes.find((el) => el.textContent?.trim().toLowerCase().includes(label))
        if (hit instanceof HTMLElement) {
          hit.click()
          break
        }
      }
    })
  } catch {
    // Optional page cleanup.
  }
}

async function scrollSearchResults(page: unknown) {
  try {
    await (page as { evaluate: (fn: () => void) => Promise<unknown> }).evaluate(() => {
      window.scrollTo(0, Math.min(900, document.body.scrollHeight))
    })
  } catch {
    // Optional page cleanup.
  }
}

async function timed<T>(label: string, fn: () => Promise<T>) {
  const startedAt = Date.now()
  try {
    return await fn()
  } finally {
    console.log(`[agent] ${label} ${Date.now() - startedAt}ms`)
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
    const url = searchUrl(plan.site, query)

    emit("navigating")
    await timed(`navigate ${plan.site}`, () => navigateFast(page, url))
    await waitForPage(page, 750)
    const firstScreenshot = await captureScreenshot(page)
    emit("searching", { currentUrl: pageUrl(page), screenshot: firstScreenshot })

    await waitForPage(page, pageWaitMs(plan.site))
    await dismissCommonOverlays(page)
    await waitForPage(page, 500)
    await scrollSearchResults(page)
    const settledScreenshot = await captureScreenshot(page) ?? firstScreenshot

    emit("extracting", { currentUrl: pageUrl(page), screenshot: settledScreenshot })
    const finding = await timed(`extract ${plan.site}`, () =>
      llm.run(() =>
        session.extract(
          `Find the best visible purchasable result for "${query}" on ${plan.site}.
           Use visible page content only. Do not click or navigate.
           Prefer exact product matches with a price. If blocked, empty, or irrelevant,
           return the best partial visible result with low confidence. Source must be "${plan.site}".`,
          FindingSchema,
          {
            ignoreSelectors: EXTRACT_IGNORE_SELECTORS,
            timeout: getExtractTimeoutMs(),
          }
        )
      )
    )

    emit("done", { finding, currentUrl: pageUrl(page), screenshot: settledScreenshot })
    return finding

  } catch (err) {
    emit("error", { error: err instanceof Error ? err.message : String(err) })
    return null
  } finally {
    await session.close()
    retireBrowserbaseSession()
  }
}
