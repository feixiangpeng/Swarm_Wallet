import { executeOne, resetConnection } from "./client"
import { isSnowflakeEnabled } from "./config"
import { resolveSnowflakeAuth } from "./credentials"
import { embedModel, isSemanticSearchEnabled } from "./semantic"

if (!isSnowflakeEnabled()) {
  console.error(
    "Snowflake is not configured. Check SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, and " +
      "SNOWFLAKE_PASSWORD or SNOWFLAKE_PRIVATE_KEY (PEM must start with -----BEGIN)."
  )
  process.exit(1)
}

if (!isSemanticSearchEnabled()) {
  console.warn("SNOWFLAKE_SEMANTIC_SEARCH=false — semantic search is disabled in .env")
}

const model = embedModel().replace(/'/g, "''")
const role = process.env.SNOWFLAKE_ROLE?.trim() || "(default)"
const warehouse = process.env.SNOWFLAKE_WAREHOUSE ?? "COMPUTE_WH"

const auth = resolveSnowflakeAuth()
console.log(`Account: ${process.env.SNOWFLAKE_ACCOUNT}`)
console.log(`User: ${process.env.SNOWFLAKE_USER}`)
console.log(`Auth: ${auth} (use jwt + registered public key to avoid MFA)`)
console.log(`Role: ${role}`)
console.log(`Warehouse: ${warehouse}`)
console.log(`Embed model: ${embedModel()}`)
console.log("Calling SNOWFLAKE.CORTEX.EMBED_TEXT_768...")

try {
  const row = await executeOne<{ OK: number }>(
    `SELECT IFF(
       SNOWFLAKE.CORTEX.EMBED_TEXT_768('${model}', ?) IS NOT NULL,
       1, 0
     ) AS OK`,
    ["Swarm Wallet cortex check"]
  )

  if (Number(row?.OK) !== 1) {
    console.error("EMBED_TEXT_768 returned NULL")
    process.exit(1)
  }

  const embedded = await executeOne<{ N: number }>(
    `SELECT COUNT(*) AS N FROM SEARCHES WHERE QUERY_EMBEDDING IS NOT NULL`
  )

  console.log("Cortex OK — EMBED_TEXT_768 returned a vector (768-dim model).")
  console.log(`Searches with embeddings in ${process.env.SNOWFLAKE_DATABASE}.${process.env.SNOWFLAKE_SCHEMA}: ${embedded?.N ?? 0}`)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error("Cortex check failed:", message)
  if (/MFA authentication is required/i.test(message)) {
    console.error(
      "MFA blocks password-based scripts. Fix key-pair JWT:\n" +
        "  1. openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub\n" +
        "  2. In Snowflake (as admin): ALTER USER LEARNER SET RSA_PUBLIC_KEY='<single-line body>';\n" +
        "  3. .env: SNOWFLAKE_AUTH=jwt and SNOWFLAKE_PRIVATE_KEY_PATH=/path/to/rsa_key.p8\n" +
        "  4. Confirm Auth: jwt above (not password) and re-run."
    )
  } else {
    console.error(
      "Common fixes: SNOWFLAKE_ROLE=TRAINING_ROLE; COMPUTE_WH running; valid PEM or .p8 path."
    )
  }
  process.exit(1)
} finally {
  resetConnection()
}
