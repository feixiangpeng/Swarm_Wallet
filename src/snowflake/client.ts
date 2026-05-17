import snowflake from "snowflake-sdk"
import { isSnowflakeEnabled, snowflakeConfig } from "./config"

snowflake.configure({ logLevel: "ERROR" })

type Row = Record<string, unknown>

let connection: snowflake.Connection | null = null
let connectPromise: Promise<snowflake.Connection> | null = null

function createConnection(): snowflake.Connection {
  const cfg = snowflakeConfig()
  const options: snowflake.ConnectionOptions = {
    account: cfg.account,
    username: cfg.username,
    warehouse: cfg.warehouse,
    database: cfg.database,
    schema: cfg.schema,
  }

  if (cfg.role) options.role = cfg.role

  if (cfg.auth === "jwt") {
    if (!cfg.privateKey) {
      throw new Error(
        "Snowflake JWT auth selected but private key is missing. " +
          "Set SNOWFLAKE_PRIVATE_KEY_PATH to your .p8 file or use SNOWFLAKE_AUTH=password."
      )
    }
    options.authenticator = "SNOWFLAKE_JWT"
    options.privateKey = cfg.privateKey
    if (cfg.privateKeyPass) {
      options.privateKeyPass = cfg.privateKeyPass
    }
  } else if (cfg.auth === "password") {
    options.password = cfg.password
  } else {
    throw new Error(
      "Snowflake credentials incomplete. Set SNOWFLAKE_PASSWORD or SNOWFLAKE_PRIVATE_KEY_PATH."
    )
  }

  return snowflake.createConnection(options)
}

export function getConnection(): Promise<snowflake.Connection> {
  if (!isSnowflakeEnabled()) {
    return Promise.reject(new Error("Snowflake is not configured"))
  }

  if (connection) return Promise.resolve(connection)
  if (connectPromise) return connectPromise

  connectPromise = new Promise((resolve, reject) => {
    const conn = createConnection()
    conn.connect((err) => {
      if (err) {
        connectPromise = null
        reject(err)
        return
      }
      connection = conn
      resolve(conn)
    })
  })

  return connectPromise
}

export async function execute<T extends Row = Row>(
  sqlText: string,
  binds: snowflake.Binds = []
): Promise<T[]> {
  const conn = await getConnection()

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText,
      binds: binds as snowflake.InsertBinds,
      complete(err, _stmt, rows) {
        if (err) reject(err)
        else resolve((rows ?? []) as T[])
      },
    })
  })
}

export async function executeOne<T extends Row = Row>(
  sqlText: string,
  binds: snowflake.Binds = []
): Promise<T | null> {
  const rows = await execute<T>(sqlText, binds)
  return rows[0] ?? null
}

export function resetConnection() {
  connection = null
  connectPromise = null
}
