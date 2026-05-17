import type { AgentUpdate } from "../agent"
import type { Verdict } from "../coordinator"
import type { SwarmPlan } from "../planner"
import type { Finding } from "../agent"
import { execute } from "./client"
import { isSnowflakeEnabled } from "./config"
import { productKey } from "./normalize"
import { embedCompletedSearch } from "./semantic"
import type { WarehouseInsights } from "./types"

export interface FindingRow {
  finding: Finding
  agentId: string
  site: string
  role: string
  replayUrl?: string
}

function logSnowflakeError(label: string, err: unknown) {
  console.warn(`[snowflake] ${label}:`, err instanceof Error ? err.message : err)
}

export async function recordSearchStart(
  searchId: string,
  query: string,
  category = "general"
): Promise<void> {
  if (!isSnowflakeEnabled()) return

  const key = productKey(query)
  try {
    await execute(
      `INSERT INTO SEARCHES (
        SEARCH_ID, QUERY_TEXT, PRODUCT_KEY, PRODUCT, CATEGORY,
        STARTED_AT, STATUS
      ) SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), 'running'`,
      [searchId, query, key, query, category]
    )
  } catch (err) {
    logSnowflakeError("recordSearchStart", err)
  }
}

export async function recordAgentEvent(
  searchId: string,
  update: AgentUpdate
): Promise<void> {
  if (!isSnowflakeEnabled()) return

  try {
    await execute(
      `INSERT INTO AGENT_EVENTS (
        SEARCH_ID, AGENT_ID, SITE, ROLE, STATUS, CURRENT_URL, ERROR_MESSAGE
      ) SELECT ?, ?, ?, ?, ?, ?, ?`,
      [
        searchId,
        update.agentId,
        update.site,
        update.role,
        update.status,
        update.currentUrl ?? null,
        update.error ?? null,
      ]
    )
  } catch (err) {
    logSnowflakeError("recordAgentEvent", err)
  }
}

export async function persistSearchComplete(args: {
  searchId: string
  query: string
  plan: SwarmPlan
  findingRows: FindingRow[]
  verdict: Verdict
  replayUrls: Record<string, string>
  startedAt: number
  outliers: WarehouseInsights["outliers"]
}): Promise<void> {
  if (!isSnowflakeEnabled()) return

  const {
    searchId,
    query,
    plan,
    findingRows,
    verdict,
    replayUrls,
    startedAt,
    outliers,
  } = args

  const key = productKey(query)
  const completedAt = Date.now()

  try {
    await execute(
      `UPDATE SEARCHES SET
        COMPLETED_AT = CURRENT_TIMESTAMP(),
        DURATION_MS = ?,
        AGENT_COUNT = ?,
        FINDING_COUNT = ?,
        STATUS = 'complete',
        PLAN_JSON = PARSE_JSON(?),
        REPLAY_URLS = PARSE_JSON(?)
      WHERE SEARCH_ID = ?`,
      [
        completedAt - startedAt,
        plan.agents.length,
        findingRows.length,
        JSON.stringify(plan),
        JSON.stringify(replayUrls),
        searchId,
      ]
    )

    for (const row of findingRows) {
      const { finding: f, agentId, site, role, replayUrl } = row
      const isOutlier = outliers.some(
        (o) => o.source === f.source && o.price === f.price
      )
      const outlierReason = outliers.find(
        (o) => o.source === f.source && o.price === f.price
      )?.reason

      await execute(
        `INSERT INTO FINDINGS (
          SEARCH_ID, AGENT_ID, PRODUCT_KEY, SITE, ROLE,
          NAME, PRICE, SOURCE, URL, HIGHLIGHT, CONFIDENCE,
          IS_OUTLIER, OUTLIER_REASON, REPLAY_URL
        ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`,
        [
          searchId,
          agentId,
          key,
          site,
          role,
          f.name,
          f.price ?? null,
          f.source,
          f.url,
          f.highlight,
          f.confidence,
          isOutlier,
          outlierReason ?? null,
          replayUrl ?? replayUrls[agentId] ?? null,
        ]
      )
    }

    await execute(
      `INSERT INTO VERDICTS (
        SEARCH_ID, RECOMMENDATION, TOP_PICKS, CAUTION, TIMING, WAREHOUSE_INSIGHTS
      ) SELECT ?, ?, PARSE_JSON(?), ?, ?, PARSE_JSON(?)`,
      [
        searchId,
        verdict.recommendation,
        JSON.stringify(verdict.top_picks),
        verdict.caution,
        verdict.timing,
        JSON.stringify(verdict.warehouse_insights ?? null),
      ]
    )

    try {
      await embedCompletedSearch(searchId, query)
    } catch (embedErr) {
      logSnowflakeError("embedCompletedSearch", embedErr)
    }
  } catch (err) {
    logSnowflakeError("persistSearchComplete", err)
  }
}

export async function persistSearchError(
  searchId: string,
  query: string,
  message: string,
  startedAt: number
): Promise<void> {
  if (!isSnowflakeEnabled()) return

  try {
    await execute(
      `UPDATE SEARCHES SET
        COMPLETED_AT = CURRENT_TIMESTAMP(),
        DURATION_MS = ?,
        STATUS = 'error',
        ERROR_MESSAGE = ?
      WHERE SEARCH_ID = ?`,
      [Date.now() - startedAt, message, searchId]
    )
  } catch (err) {
    logSnowflakeError("persistSearchError", err)
  }
}

/** Fire-and-forget wrapper — never blocks the swarm. */
export function snowflakeAsync(label: string, fn: () => Promise<void>) {
  void fn().catch((err) => logSnowflakeError(label, err))
}
