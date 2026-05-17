import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

export type SnowflakeAuthMethod = "password" | "jwt" | "none"

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim()
}

/** Strip .env quoting (including accidental triple-quotes around multiline PEM). */
function stripEnvQuotes(value: string): string {
  let v = value.trim()
  if (v.startsWith('"""') && v.endsWith('"""')) {
    v = v.slice(3, -3).trim()
  } else if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function looksLikePem(value: string): boolean {
  return /-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(value)
}

function looksLikeKeyPath(value: string): boolean {
  const v = value.trim()
  return (
    v.startsWith("/") ||
    v.startsWith("./") ||
    v.endsWith(".p8") ||
    v.endsWith(".pem")
  )
}

function readKeyFile(filePath: string): string {
  const resolved = resolve(filePath.trim())
  if (!existsSync(resolved)) {
    throw new Error(`Snowflake private key file not found: ${resolved}`)
  }
  return normalizePem(readFileSync(resolved, "utf8"))
}

/** Load PKCS#8 (or RSA) PEM from SNOWFLAKE_PRIVATE_KEY_PATH, inline PEM, or a path in SNOWFLAKE_PRIVATE_KEY. */
export function loadPrivateKeyPem(): string | undefined {
  const pathEnv = process.env.SNOWFLAKE_PRIVATE_KEY_PATH?.trim()
  const inline = process.env.SNOWFLAKE_PRIVATE_KEY?.trim()

  if (pathEnv) return readKeyFile(pathEnv)

  if (!inline) return undefined

  const pem = stripEnvQuotes(inline)
  if (looksLikePem(pem)) return normalizePem(pem)
  if (looksLikeKeyPath(pem)) return readKeyFile(pem)

  return undefined
}

export function resolveSnowflakeAuth(): SnowflakeAuthMethod {
  if (process.env.SNOWFLAKE_AUTH === "password") {
    return process.env.SNOWFLAKE_PASSWORD?.trim() ? "password" : "none"
  }
  if (process.env.SNOWFLAKE_AUTH === "jwt" || process.env.SNOWFLAKE_AUTH === "keypair") {
    try {
      return loadPrivateKeyPem() ? "jwt" : "none"
    } catch {
      return "none"
    }
  }

  try {
    if (loadPrivateKeyPem()) return "jwt"
  } catch {
    // invalid path — fall through to password if set
  }

  if (process.env.SNOWFLAKE_PASSWORD?.trim()) return "password"
  return "none"
}

export function hasSnowflakeCredentials(): boolean {
  return Boolean(
    process.env.SNOWFLAKE_ACCOUNT?.trim() &&
      process.env.SNOWFLAKE_USER?.trim() &&
      resolveSnowflakeAuth() !== "none"
  )
}
