import { execute, executeOne } from "./client"
import { isSnowflakeEnabled } from "./config"

const DEFAULT_MODEL = "snowflake-arctic-embed-m-v1.5"
const DEFAULT_THRESHOLD = 0.72

export function isSemanticSearchEnabled(): boolean {
  if (process.env.SNOWFLAKE_SEMANTIC_SEARCH === "false") return false
  return isSnowflakeEnabled()
}

export function embedModel(): string {
  return process.env.SNOWFLAKE_EMBED_MODEL?.trim() || DEFAULT_MODEL
}

export function similarityThreshold(): number {
  const n = Number(process.env.SNOWFLAKE_SIMILARITY_THRESHOLD)
  return Number.isFinite(n) && n > 0 && n < 1 ? n : DEFAULT_THRESHOLD
}

function embedExpr(textBind: string): string {
  const model = embedModel().replace(/'/g, "''")
  return `SNOWFLAKE.CORTEX.EMBED_TEXT_768('${model}', ${textBind})`
}

/** Backfill embeddings for a completed search (call after rows exist). */
export async function embedCompletedSearch(searchId: string, query: string): Promise<void> {
  if (!isSemanticSearchEnabled()) return

  const embed = embedExpr("?")

  await execute(
    `UPDATE SEARCHES
     SET QUERY_EMBEDDING = ${embed}
     WHERE SEARCH_ID = ?`,
    [query, searchId]
  )

  const findingEmbed = embedExpr(
    "COALESCE(NAME, '') || ' — ' || COALESCE(HIGHLIGHT, '')"
  )

  await execute(
    `UPDATE FINDINGS
     SET
       TEXT_FOR_EMBED = COALESCE(NAME, '') || ' — ' || COALESCE(HIGHLIGHT, ''),
       FINDING_EMBEDDING = ${findingEmbed}
     WHERE SEARCH_ID = ?`,
    [searchId]
  )
}

export interface SimilarSearch {
  query_text: string
  product_key: string
  similarity: number
  finding_count: number | null
}

export interface SemanticSiteScore {
  site: string
  /** Sum of cosine similarity from matching swarms (higher = stronger memory). */
  score: number
  priced_findings: number
  avg_price: number | null
  min_price: number | null
}

/** Sites that priced well on semantically similar past swarms — used for planner routing. */
export async function findSitesFromSimilarSearches(
  query: string,
  siteFilter?: string[]
): Promise<SemanticSiteScore[]> {
  if (!isSemanticSearchEnabled()) return []

  try {
    const embed = embedExpr("?")
    const threshold = similarityThreshold()
    const binds: (string | number)[] = [query, query]

    let siteClause = ""
    if (siteFilter && siteFilter.length > 0) {
      siteClause = ` AND f.SITE IN (${siteFilter.map(() => "?").join(", ")})`
      binds.push(...siteFilter)
    }

    const rows = await execute<{
      SITE: string
      SCORE: number
      PRICED_FINDINGS: number
      AVG_PRICE: number
      MIN_PRICE: number
    }>(
      `WITH scored AS (
         SELECT SEARCH_ID,
           VECTOR_COSINE_SIMILARITY(QUERY_EMBEDDING, ${embed}) AS SIM
         FROM SEARCHES
         WHERE STATUS = 'complete'
           AND QUERY_EMBEDDING IS NOT NULL
           AND LOWER(TRIM(QUERY_TEXT)) != LOWER(TRIM(?))
       ),
       similar AS (
         SELECT SEARCH_ID, SIM FROM scored
         WHERE SIM >= ${threshold}
         ORDER BY SIM DESC
         LIMIT 8
       )
       SELECT
         f.SITE,
         SUM(s.SIM) AS SCORE,
         COUNT(*) AS PRICED_FINDINGS,
         AVG(f.PRICE) AS AVG_PRICE,
         MIN(f.PRICE) AS MIN_PRICE
       FROM FINDINGS f
       INNER JOIN similar s ON f.SEARCH_ID = s.SEARCH_ID
       WHERE f.PRICE IS NOT NULL${siteClause}
       GROUP BY f.SITE
       ORDER BY SCORE DESC, PRICED_FINDINGS DESC`,
      binds
    )

    return rows.map((r) => ({
      site: String(r.SITE),
      score: Number(r.SCORE),
      priced_findings: Number(r.PRICED_FINDINGS),
      avg_price: r.AVG_PRICE != null ? Number(r.AVG_PRICE) : null,
      min_price: r.MIN_PRICE != null ? Number(r.MIN_PRICE) : null,
    }))
  } catch (err) {
    console.warn("[snowflake] findSitesFromSimilarSearches:", err)
    return []
  }
}

export async function findSimilarSearches(
  query: string,
  limit = 5
): Promise<SimilarSearch[]> {
  if (!isSemanticSearchEnabled()) return []

  try {
    const embed = embedExpr("?")
    const rows = await execute<{
      QUERY_TEXT: string
      PRODUCT_KEY: string
      SIMILARITY: number
      FINDING_COUNT: number
    }>(
      `SELECT QUERY_TEXT, PRODUCT_KEY, FINDING_COUNT,
        VECTOR_COSINE_SIMILARITY(QUERY_EMBEDDING, ${embed}) AS SIMILARITY
       FROM SEARCHES
       WHERE STATUS = 'complete'
         AND QUERY_EMBEDDING IS NOT NULL
         AND LOWER(TRIM(QUERY_TEXT)) != LOWER(TRIM(?))
       ORDER BY SIMILARITY DESC
       LIMIT ${Math.min(limit, 20)}`,
      [query, query]
    )

    const threshold = similarityThreshold()
    return rows
      .map((r) => ({
        query_text: String(r.QUERY_TEXT),
        product_key: String(r.PRODUCT_KEY),
        similarity: Number(r.SIMILARITY),
        finding_count: r.FINDING_COUNT != null ? Number(r.FINDING_COUNT) : null,
      }))
      .filter((r) => r.similarity >= threshold)
  } catch (err) {
    console.warn("[snowflake] findSimilarSearches:", err)
    return []
  }
}

export async function loadSemanticPriceHistory(query: string): Promise<{
  observation_count: number
  min_price_90d: number | null
  max_price_90d: number | null
  avg_price_90d: number | null
  days_of_history: number
} | null> {
  if (!isSemanticSearchEnabled()) return null

  try {
    const embed = embedExpr("?")
    const threshold = similarityThreshold()

    const row = await executeOne<{
      OBSERVATION_COUNT: number
      MIN_PRICE_90D: number
      MAX_PRICE_90D: number
      AVG_PRICE_90D: number
      DAYS_OF_HISTORY: number
    }>(
      `WITH scored AS (
         SELECT SEARCH_ID,
           VECTOR_COSINE_SIMILARITY(QUERY_EMBEDDING, ${embed}) AS SIM
         FROM SEARCHES
         WHERE STATUS = 'complete' AND QUERY_EMBEDDING IS NOT NULL
       ),
       similar AS (
         SELECT SEARCH_ID FROM scored
         WHERE SIM >= ${threshold}
         ORDER BY SIM DESC
         LIMIT 8
       )
       SELECT
         COUNT(*) AS OBSERVATION_COUNT,
         MIN(f.PRICE) AS MIN_PRICE_90D,
         MAX(f.PRICE) AS MAX_PRICE_90D,
         AVG(f.PRICE) AS AVG_PRICE_90D,
         COALESCE(DATEDIFF('day', MIN(f.RECORDED_AT), CURRENT_TIMESTAMP()), 0) AS DAYS_OF_HISTORY
       FROM FINDINGS f
       INNER JOIN similar s ON f.SEARCH_ID = s.SEARCH_ID
       WHERE f.PRICE IS NOT NULL
         AND f.RECORDED_AT >= DATEADD(day, -90, CURRENT_TIMESTAMP())`,
      [query]
    )

    if (!row || Number(row.OBSERVATION_COUNT) < 1) return null

    return {
      observation_count: Number(row.OBSERVATION_COUNT),
      min_price_90d: row.MIN_PRICE_90D != null ? Number(row.MIN_PRICE_90D) : null,
      max_price_90d: row.MAX_PRICE_90D != null ? Number(row.MAX_PRICE_90D) : null,
      avg_price_90d: row.AVG_PRICE_90D != null ? Number(row.AVG_PRICE_90D) : null,
      days_of_history: Number(row.DAYS_OF_HISTORY ?? 0),
    }
  } catch (err) {
    console.warn("[snowflake] loadSemanticPriceHistory:", err)
    return null
  }
}
