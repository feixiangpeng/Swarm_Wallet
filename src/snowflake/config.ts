import { hasSnowflakeCredentials, loadPrivateKeyPem, resolveSnowflakeAuth } from "./credentials"

export function isSnowflakeEnabled(): boolean {
  if (process.env.SNOWFLAKE_ENABLED === "false") return false
  return hasSnowflakeCredentials()
}

export function snowflakeConfig() {
  const auth = resolveSnowflakeAuth()
  return {
    account: process.env.SNOWFLAKE_ACCOUNT!.trim(),
    username: process.env.SNOWFLAKE_USER!.trim(),
    auth,
    password: auth === "password" ? process.env.SNOWFLAKE_PASSWORD : undefined,
    privateKey: auth === "jwt" ? loadPrivateKeyPem() : undefined,
    privateKeyPass: process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? "COMPUTE_WH",
    database: process.env.SNOWFLAKE_DATABASE ?? "SWARM_WALLET",
    schema: process.env.SNOWFLAKE_SCHEMA ?? "APP",
    role: process.env.SNOWFLAKE_ROLE,
  }
}
