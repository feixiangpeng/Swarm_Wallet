import { execute } from "./client"
import { isSemanticSearchEnabled } from "./semantic"

export interface SnowflakeDashboard {
  summary: {
    searches: number
    priced_findings: number
    products_tracked: number
    searches_embedded: number
  }
  semantic_enabled: boolean
  recent_searches: Array<{
    query_text: string
    status: string
    finding_count: number | null
    duration_ms: number | null
    completed_at: string | null
  }>
  site_reliability: Array<{
    site: string
    role: string
    success_pct: number
    sample_size: number
  }>
  price_history: Array<{
    product_key: string
    observation_count: number
    min_price_90d: number | null
    avg_price_90d: number | null
    max_price_90d: number | null
    days_of_history: number
  }>
  daily_prices: Array<{
    product_key: string
    site: string
    price_day: string
    min_price: number
    avg_price: number
    observation_count: number
  }>
  outliers: Array<{
    product_key: string
    site: string
    price: number
    outlier_reason: string | null
    recorded_at: string
  }>
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v)
}

function str(v: unknown): string {
  return v == null ? "" : String(v)
}

export async function fetchSnowflakeDashboard(): Promise<SnowflakeDashboard> {
  const [summaryRows, recent, reliability, history, outliers] = await Promise.all([
    execute<{
      SEARCHES: number
      PRICED_FINDINGS: number
      PRODUCTS_TRACKED: number
      SEARCHES_EMBEDDED: number
    }>(
      `SELECT
        (SELECT COUNT(*) FROM SEARCHES) AS SEARCHES,
        (SELECT COUNT(*) FROM FINDINGS WHERE PRICE IS NOT NULL) AS PRICED_FINDINGS,
        (SELECT COUNT(DISTINCT PRODUCT_KEY) FROM FINDINGS) AS PRODUCTS_TRACKED,
        (SELECT COUNT(*) FROM SEARCHES WHERE QUERY_EMBEDDING IS NOT NULL) AS SEARCHES_EMBEDDED`
    ),
    execute<{
      QUERY_TEXT: string
      STATUS: string
      FINDING_COUNT: number
      DURATION_MS: number
      COMPLETED_AT: string
    }>(
      `SELECT QUERY_TEXT, STATUS, FINDING_COUNT, DURATION_MS, COMPLETED_AT
       FROM SEARCHES
       ORDER BY COMPLETED_AT DESC NULLS LAST
       LIMIT 12`
    ),
    execute<{
      SITE: string
      ROLE: string
      SUCCESS_PCT: number
      SAMPLE_SIZE: number
    }>(
      `SELECT SITE, ROLE, ROUND(SUCCESS_RATE * 100, 1) AS SUCCESS_PCT, SAMPLE_SIZE
       FROM SITE_RELIABILITY
       ORDER BY SUCCESS_RATE DESC
       LIMIT 12`
    ),
    execute<{
      PRODUCT_KEY: string
      OBSERVATION_COUNT: number
      MIN_PRICE_90D: number
      AVG_PRICE_90D: number
      MAX_PRICE_90D: number
      DAYS_OF_HISTORY: number
    }>(
      `SELECT PRODUCT_KEY, OBSERVATION_COUNT, MIN_PRICE_90D, AVG_PRICE_90D, MAX_PRICE_90D, DAYS_OF_HISTORY
       FROM PRODUCT_PRICE_STATS
       ORDER BY OBSERVATION_COUNT DESC
       LIMIT 10`
    ),
    execute<{
      PRODUCT_KEY: string
      SITE: string
      PRICE: number
      OUTLIER_REASON: string
      RECORDED_AT: string
    }>(
      `SELECT PRODUCT_KEY, SITE, PRICE, OUTLIER_REASON, RECORDED_AT
       FROM FINDINGS
       WHERE IS_OUTLIER = TRUE
       ORDER BY RECORDED_AT DESC
       LIMIT 15`
    ),
  ])

  let daily: SnowflakeDashboard["daily_prices"] = []
  try {
    const rows = await execute<{
      PRODUCT_KEY: string
      SITE: string
      PRICE_DAY: string
      MIN_PRICE: number
      AVG_PRICE: number
      OBSERVATION_COUNT: number
    }>(
      `SELECT PRODUCT_KEY, SITE, PRICE_DAY, MIN_PRICE, AVG_PRICE, OBSERVATION_COUNT
       FROM PRODUCT_PRICE_DAILY
       ORDER BY PRICE_DAY DESC
       LIMIT 20`
    )
    daily = rows.map((r) => ({
      product_key: str(r.PRODUCT_KEY),
      site: str(r.SITE),
      price_day: str(r.PRICE_DAY),
      min_price: num(r.MIN_PRICE),
      avg_price: num(r.AVG_PRICE),
      observation_count: num(r.OBSERVATION_COUNT),
    }))
  } catch {
    // dynamic table may not exist yet
  }

  const s = summaryRows[0]

  return {
    summary: {
      searches: num(s?.SEARCHES),
      priced_findings: num(s?.PRICED_FINDINGS),
      products_tracked: num(s?.PRODUCTS_TRACKED),
      searches_embedded: num(s?.SEARCHES_EMBEDDED),
    },
    semantic_enabled: isSemanticSearchEnabled(),
    recent_searches: recent.map((r) => ({
      query_text: str(r.QUERY_TEXT),
      status: str(r.STATUS),
      finding_count: r.FINDING_COUNT != null ? num(r.FINDING_COUNT) : null,
      duration_ms: r.DURATION_MS != null ? num(r.DURATION_MS) : null,
      completed_at: r.COMPLETED_AT != null ? str(r.COMPLETED_AT) : null,
    })),
    site_reliability: reliability.map((r) => ({
      site: str(r.SITE),
      role: str(r.ROLE),
      success_pct: num(r.SUCCESS_PCT),
      sample_size: num(r.SAMPLE_SIZE),
    })),
    price_history: history.map((r) => ({
      product_key: str(r.PRODUCT_KEY),
      observation_count: num(r.OBSERVATION_COUNT),
      min_price_90d: r.MIN_PRICE_90D != null ? num(r.MIN_PRICE_90D) : null,
      avg_price_90d: r.AVG_PRICE_90D != null ? num(r.AVG_PRICE_90D) : null,
      max_price_90d: r.MAX_PRICE_90D != null ? num(r.MAX_PRICE_90D) : null,
      days_of_history: num(r.DAYS_OF_HISTORY),
    })),
    daily_prices: daily,
    outliers: outliers.map((r) => ({
      product_key: str(r.PRODUCT_KEY),
      site: str(r.SITE),
      price: num(r.PRICE),
      outlier_reason: r.OUTLIER_REASON != null ? str(r.OUTLIER_REASON) : null,
      recorded_at: str(r.RECORDED_AT),
    })),
  }
}
