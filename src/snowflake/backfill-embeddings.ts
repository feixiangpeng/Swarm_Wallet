import { execute } from "./client"
import { embedCompletedSearch, isSemanticSearchEnabled } from "./semantic"

/**
 * Embed all completed searches missing QUERY_EMBEDDING.
 * Run after enabling semantic search on existing data:
 *   npm run snowflake:backfill-embeddings
 */
async function backfillEmbeddings() {
  if (!isSemanticSearchEnabled()) {
    throw new Error("Snowflake + semantic search must be enabled in .env")
  }

  const rows = await execute<{ SEARCH_ID: string; QUERY_TEXT: string }>(
    `SELECT SEARCH_ID, QUERY_TEXT
     FROM SEARCHES
     WHERE STATUS = 'complete' AND QUERY_EMBEDDING IS NULL
     ORDER BY COMPLETED_AT ASC
     LIMIT 100`
  )

  console.log(`[snowflake] backfilling ${rows.length} search(es)...`)

  for (const row of rows) {
    const id = String(row.SEARCH_ID)
    const query = String(row.QUERY_TEXT)
    console.log(`  embedding: ${query.slice(0, 60)}...`)
    await embedCompletedSearch(id, query)
  }

  console.log("[snowflake] backfill complete")
}

backfillEmbeddings()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
