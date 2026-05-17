import { execute, executeOne } from "./client"
import { isSnowflakeEnabled } from "./config"

export interface DeleteSearchResult {
  deleted: boolean
  search_id: string
  query_text?: string
  agent_events_removed: number
  findings_removed: number
  verdict_removed: boolean
}

/** Remove one swarm and all related rows (including query/finding vectors). */
export async function deleteSearch(searchId: string): Promise<DeleteSearchResult> {
  if (!isSnowflakeEnabled()) {
    throw new Error("Snowflake is not configured")
  }

  const id = searchId.trim()
  if (!id) throw new Error("search_id is required")

  const row = await executeOne<{ QUERY_TEXT: string }>(
    `SELECT QUERY_TEXT FROM SEARCHES WHERE SEARCH_ID = ?`,
    [id]
  )

  if (!row) {
    return {
      deleted: false,
      search_id: id,
      agent_events_removed: 0,
      findings_removed: 0,
      verdict_removed: false,
    }
  }

  const [ev, fi, ve] = await Promise.all([
    executeOne<{ N: number }>(
      `SELECT COUNT(*) AS N FROM AGENT_EVENTS WHERE SEARCH_ID = ?`,
      [id]
    ),
    executeOne<{ N: number }>(
      `SELECT COUNT(*) AS N FROM FINDINGS WHERE SEARCH_ID = ?`,
      [id]
    ),
    executeOne<{ N: number }>(
      `SELECT COUNT(*) AS N FROM VERDICTS WHERE SEARCH_ID = ?`,
      [id]
    ),
  ])

  await execute(`DELETE FROM AGENT_EVENTS WHERE SEARCH_ID = ?`, [id])
  await execute(`DELETE FROM FINDINGS WHERE SEARCH_ID = ?`, [id])
  await execute(`DELETE FROM VERDICTS WHERE SEARCH_ID = ?`, [id])
  await execute(`DELETE FROM SEARCHES WHERE SEARCH_ID = ?`, [id])

  return {
    deleted: true,
    search_id: id,
    query_text: String(row.QUERY_TEXT),
    agent_events_removed: Number(ev?.N ?? 0),
    findings_removed: Number(fi?.N ?? 0),
    verdict_removed: Number(ve?.N ?? 0) > 0,
  }
}
