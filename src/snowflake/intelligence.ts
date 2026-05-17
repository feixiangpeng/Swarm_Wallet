import type { Finding } from "../agent"
import type { AgentPlan } from "../planner"
import { execute, executeOne } from "./client"
import { isSnowflakeEnabled } from "./config"
import { productKey, siteFromSource } from "./normalize"
import {
  findSimilarSearches,
  isSemanticSearchEnabled,
  loadSemanticPriceHistory,
} from "./semantic"
import type {
  IntelligenceContext,
  SiteReliabilityRow,
  WarehouseInsights,
} from "./types"

function emptyInsights(): WarehouseInsights {
  return {
    timing_signal: "No Snowflake price history yet — timing based on this scan only.",
    price_history: {
      observation_count: 0,
      min_price_90d: null,
      max_price_90d: null,
      avg_price_90d: null,
      days_of_history: 0,
    },
    outliers: [],
    collective_hint: null,
    best_historical_site: null,
    similar_searches: [],
    semantic_search_enabled: false,
  }
}

function mergePriceHistory(
  exact: WarehouseInsights["price_history"],
  semantic: WarehouseInsights["price_history"] | null
): WarehouseInsights["price_history"] {
  if (!semantic || semantic.observation_count <= exact.observation_count) {
    return exact
  }
  return semantic
}

export async function getSiteReliability(): Promise<SiteReliabilityRow[]> {
  if (!isSnowflakeEnabled()) return []

  try {
    const rows = await execute<{
      SITE: string
      ROLE: string
      SUCCESS_RATE: number
      SAMPLE_SIZE: number
    }>(
      `SELECT SITE, ROLE, SUCCESS_RATE, SAMPLE_SIZE
       FROM SITE_RELIABILITY
       ORDER BY SUCCESS_RATE DESC, SAMPLE_SIZE DESC
       LIMIT 24`
    )

    return rows.map((r) => ({
      site: r.SITE,
      role: r.ROLE,
      success_rate: Number(r.SUCCESS_RATE),
      sample_size: Number(r.SAMPLE_SIZE),
    }))
  } catch {
    return []
  }
}

export async function getPlannerSiteBoost(
  query: string,
  baseAgents: AgentPlan[]
): Promise<{ agents: AgentPlan[]; reasoning: string }> {
  const reliability = await getSiteReliability()
  if (reliability.length === 0) {
    return {
      agents: baseAgents,
      reasoning: "default site list (no Snowflake history yet)",
    }
  }

  const scoreMap = new Map(
    reliability.map((r) => [`${r.site}::${r.role}`, r.success_rate])
  )

  const sorted = [...baseAgents].sort((a, b) => {
    const sa = scoreMap.get(`${a.site}::${a.role}`) ?? 0
    const sb = scoreMap.get(`${b.site}::${b.role}`) ?? 0
    return sb - sa
  })

  const top = reliability[0]
  return {
    agents: sorted,
    reasoning: `Snowflake ranked agents by 30-day success rate (top: ${top.site} ${Math.round(top.success_rate * 100)}%)`,
  }
}

export async function detectOutliers(
  key: string,
  findings: Finding[]
): Promise<WarehouseInsights["outliers"]> {
  const priced = findings.filter((f) => f.price != null)
  if (priced.length === 0) return []

  const outliers: WarehouseInsights["outliers"] = []

  if (!isSnowflakeEnabled()) {
    const prices = priced.map((f) => f.price!)
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length
    const std =
      Math.sqrt(
        prices.reduce((s, p) => s + (p - mean) ** 2, 0) / Math.max(prices.length, 1)
      ) || 1

    for (const f of priced) {
      if (f.price! < mean - 2 * std) {
        outliers.push({
          source: f.source,
          site: siteFromSource(f.source),
          price: f.price!,
          reason: "Much lower than other agents in this scan",
        })
      }
    }
    return outliers
  }

  try {
    for (const f of priced) {
      const site = siteFromSource(f.source)
      const row = await executeOne<{
        OBS_COUNT: number
        AVG_PRICE: number
        STDDEV_PRICE: number
        P05: number
      }>(
        `SELECT
          COUNT(*) AS OBS_COUNT,
          AVG(PRICE) AS AVG_PRICE,
          STDDEV(PRICE) AS STDDEV_PRICE,
          PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY PRICE) AS P05
        FROM FINDINGS
        WHERE PRODUCT_KEY = ?
          AND SITE = ?
          AND PRICE IS NOT NULL
          AND RECORDED_AT >= DATEADD(day, -90, CURRENT_TIMESTAMP())`,
        [key, site]
      )

      if (!row || Number(row.OBS_COUNT) < 3) continue

      const avg = Number(row.AVG_PRICE)
      const std = Number(row.STDDEV_PRICE) || 0
      const p05 = Number(row.P05)
      const price = f.price!

      if (price < p05 || (std > 0 && price < avg - 2.5 * std)) {
        outliers.push({
          source: f.source,
          site,
          price,
          reason: `Below 90-day norm for ${site} (avg $${avg.toFixed(0)}, p05 $${p05.toFixed(0)})`,
        })
      } else if (std > 0 && price > avg + 3 * std) {
        outliers.push({
          source: f.source,
          site,
          price,
          reason: `Unusually high vs 90-day history on ${site}`,
        })
      }
    }
  } catch (err) {
    console.warn("[snowflake] detectOutliers:", err)
  }

  return outliers
}

async function loadPriceHistory(key: string): Promise<WarehouseInsights["price_history"]> {
  const empty = emptyInsights().price_history

  if (!isSnowflakeEnabled()) return empty

  try {
    const row = await executeOne<{
      OBSERVATION_COUNT: number
      MIN_PRICE_90D: number
      MAX_PRICE_90D: number
      AVG_PRICE_90D: number
      DAYS_OF_HISTORY: number
    }>(
      `SELECT OBSERVATION_COUNT, MIN_PRICE_90D, MAX_PRICE_90D, AVG_PRICE_90D, DAYS_OF_HISTORY
       FROM PRODUCT_PRICE_STATS
       WHERE PRODUCT_KEY = ?`,
      [key]
    )

    if (!row) return empty

    return {
      observation_count: Number(row.OBSERVATION_COUNT),
      min_price_90d: row.MIN_PRICE_90D != null ? Number(row.MIN_PRICE_90D) : null,
      max_price_90d: row.MAX_PRICE_90D != null ? Number(row.MAX_PRICE_90D) : null,
      avg_price_90d: row.AVG_PRICE_90D != null ? Number(row.AVG_PRICE_90D) : null,
      days_of_history: Number(row.DAYS_OF_HISTORY ?? 0),
    }
  } catch {
    return empty
  }
}

async function loadCollectiveHint(key: string): Promise<{
  hint: string | null
  bestSite: string | null
}> {
  if (!isSnowflakeEnabled()) return { hint: null, bestSite: null }

  try {
    const row = await executeOne<{ SITE: string; AVG_PRICE: number; SAMPLES: number }>(
      `SELECT SITE, AVG_PRICE, SAMPLES
       FROM COLLECTIVE_BEST_SITE
       WHERE PRODUCT_KEY = ? AND PRICE_RANK = 1`,
      [key]
    )

    if (!row) return { hint: null, bestSite: null }

    const site = row.SITE
    const avg = Number(row.AVG_PRICE)
    const samples = Number(row.SAMPLES)

    return {
      bestSite: site,
      hint: `Across ${samples} prior swarms, median best price for this product was on ${site} (~$${avg.toFixed(0)}).`,
    }
  } catch {
    return { hint: null, bestSite: null }
  }
}

function buildTimingSignal(
  history: WarehouseInsights["price_history"],
  findings: Finding[],
  outliers: WarehouseInsights["outliers"]
): string {
  const prices = findings.map((f) => f.price).filter((p): p is number => p != null)
  if (prices.length === 0) {
    return "No prices extracted this scan."
  }

  const currentMin = Math.min(...prices)
  const parts: string[] = []

  if (history.observation_count >= 3 && history.min_price_90d != null) {
    if (currentMin <= history.min_price_90d * 1.02) {
      parts.push(
        `Current low $${currentMin.toFixed(0)} is at or below the 90-day floor ($${history.min_price_90d.toFixed(0)}) across ${history.observation_count} observations.`
      )
    } else if (history.avg_price_90d != null && currentMin < history.avg_price_90d * 0.95) {
      const pct = Math.round((1 - currentMin / history.avg_price_90d) * 100)
      parts.push(
        `Current low is ~${pct}% below the 90-day average ($${history.avg_price_90d.toFixed(0)}).`
      )
    } else if (history.avg_price_90d != null && currentMin > history.avg_price_90d * 1.08) {
      parts.push(
        `Prices are elevated vs 90-day average ($${history.avg_price_90d.toFixed(0)}) — consider waiting.`
      )
    } else {
      parts.push(
        `In line with 90-day range ($${history.min_price_90d.toFixed(0)}–$${history.max_price_90d?.toFixed(0) ?? "?"}).`
      )
    }
  } else {
    parts.push("No exact product history yet — timing uses this scan only.")
  }

  if (outliers.length > 0) {
    parts.push(`${outliers.length} listing(s) flagged as statistical outliers — verify before buying.`)
  }

  return parts.join(" ")
}

export async function buildIntelligenceContext(
  query: string,
  findings: Finding[]
): Promise<IntelligenceContext> {
  const key = productKey(query)
  const site_reliability = await getSiteReliability()
  const outliers = await detectOutliers(key, findings)
  const exactHistory = await loadPriceHistory(key)
  const semanticHistory = isSemanticSearchEnabled()
    ? await loadSemanticPriceHistory(query)
    : null
  const similar = isSemanticSearchEnabled() ? await findSimilarSearches(query) : []
  const price_history = mergePriceHistory(exactHistory, semanticHistory)
  const { hint, bestSite } = await loadCollectiveHint(key)

  let collective_hint = hint
  if (similar.length > 0) {
    const labels = similar
      .slice(0, 3)
      .map((s) => `"${s.query_text}" (${Math.round(s.similarity * 100)}% match)`)
      .join(", ")
    const semanticNote = `Semantically similar past swarms: ${labels}.`
    collective_hint = collective_hint ? `${collective_hint} ${semanticNote}` : semanticNote
  }

  let timing_signal = buildTimingSignal(price_history, findings, outliers)
  if (semanticHistory && semanticHistory.observation_count > exactHistory.observation_count) {
    timing_signal = `[Semantic memory] ${timing_signal}`
  }

  const insights: WarehouseInsights = {
    timing_signal,
    price_history,
    outliers,
    collective_hint,
    best_historical_site: bestSite,
    similar_searches: similar.map((s) => ({
      query_text: s.query_text,
      product_key: s.product_key,
      similarity: s.similarity,
    })),
    semantic_search_enabled: isSemanticSearchEnabled(),
  }

  const planner_hint =
    site_reliability.length > 0
      ? `Prefer agents on ${site_reliability.slice(0, 3).map((s) => s.site).join(", ")} (highest success rates).`
      : null

  return { insights, planner_hint, site_reliability }
}

export function emptyIntelligenceContext(): IntelligenceContext {
  return {
    insights: emptyInsights(),
    planner_hint: null,
    site_reliability: [],
  }
}
