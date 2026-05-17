export const DEFAULT_BROWSER_SESSION_CONCURRENCY = 4
export const DEFAULT_WARM_BROWSERBASE_WAIT_MS = 30_000

function positiveInteger(value: string | undefined, fallback: number) {
  if (value == null || value.trim() === "") return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallback
}

export function getMaxBrowserSessions() {
  return positiveInteger(
    process.env.MAX_BROWSER_SESSIONS,
    DEFAULT_BROWSER_SESSION_CONCURRENCY
  )
}

export function getPrewarmBrowserSessions() {
  return positiveInteger(
    process.env.PREWARM_BROWSERBASE_SESSIONS,
    getMaxBrowserSessions()
  )
}

export function getWarmBrowserbaseWaitMs() {
  return positiveInteger(
    process.env.WARM_BROWSERBASE_WAIT_MS,
    DEFAULT_WARM_BROWSERBASE_WAIT_MS
  )
}

