import { createBrowserbaseSession, type V3 } from "./stagehand"
import { getPrewarmBrowserSessions, getWarmBrowserbaseWaitMs } from "./config"

type Waiter = {
  resolve: (session: V3 | null) => void
  timeout: NodeJS.Timeout
}

let pool: V3[] = []
let waiters: Waiter[] = []
let warming = 0
let leased = 0
let started = false
let observedConcurrentLimit: number | null = null
let cooldownUntil = 0
let authFailureReason: string | null = null
let fillTimer: NodeJS.Timeout | null = null

function prewarmConfigured() {
  return process.env.PREWARM_BROWSERBASE !== "false"
}

function prewarmEnabled() {
  return prewarmConfigured() && authFailureReason == null
}

function targetSize() {
  const configured = getPrewarmBrowserSessions()
  return observedConcurrentLimit == null
    ? configured
    : Math.min(configured, observedConcurrentLimit)
}

function warmSessionWaitMs() {
  return getWarmBrowserbaseWaitMs()
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return String(err)
}

function isAuthError(err: unknown, message = errorMessage(err)) {
  return (
    (err as { status?: number }).status === 401 ||
    message.includes("Unauthorized Project ID") ||
    message.includes("Unauthorized")
  )
}

function resolveWaitersWithNull() {
  for (const waiter of waiters) {
    clearTimeout(waiter.timeout)
    waiter.resolve(null)
  }
  waiters = []
}

function disableForAuthFailure(message: string) {
  if (authFailureReason) return

  authFailureReason = `Browserbase authentication failed: ${message}`
  console.error(
    `[prewarm] ${authFailureReason}. Check BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID in .env. Disabling prewarm.`
  )
  resolveWaitersWithNull()
}

function retryDelayMs(err: unknown) {
  const headers = (err as { headers?: Record<string, string> }).headers
  const retryAfter = Number(headers?.["retry-after"])
  const reset = Number(headers?.["ratelimit-reset"])

  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000
  if (Number.isFinite(reset) && reset > 0) return reset * 1000
  return 10_000
}

function learnFromError(err: unknown) {
  const message = errorMessage(err)
  const concurrentLimit = message.match(/max concurrent sessions limit \(limit (\d+), currently \d+\)/)

  if (isAuthError(err, message)) {
    disableForAuthFailure(message)
    return
  }

  if (concurrentLimit) {
    observedConcurrentLimit = Number(concurrentLimit[1])
    cooldownUntil = Date.now() + retryDelayMs(err)
    console.warn(`[prewarm] Browserbase concurrent session limit is ${observedConcurrentLimit}; backing off.`)
    return
  }

  if (message.includes("burst rate limit") || (err as { status?: number }).status === 429) {
    cooldownUntil = Date.now() + retryDelayMs(err)
    console.warn(`[prewarm] Browserbase rate limited; retrying after ${Math.ceil((cooldownUntil - Date.now()) / 1000)}s.`)
    return
  }

  console.error("[prewarm] Browserbase session failed:", err)
}

function giveSession(session: V3) {
  const waiter = waiters.shift()
  if (waiter) {
    clearTimeout(waiter.timeout)
    leased += 1
    waiter.resolve(session)
    return
  }

  pool.push(session)
}

function scheduleFillPool(delayMs: number) {
  if (fillTimer) return

  fillTimer = setTimeout(() => {
    fillTimer = null
    fillPool()
  }, delayMs)
}

function fillPool() {
  if (!prewarmEnabled()) return
  if (Date.now() < cooldownUntil) {
    scheduleFillPool(cooldownUntil - Date.now())
    return
  }

  const target = Math.max(0, targetSize())
  while (pool.length + warming + leased < target) {
    const slot = pool.length + warming + leased + 1
    warming += 1
    console.log(`[prewarm] starting Browserbase session ${slot}/${target}`)
    void createWarmSession()
  }
}

async function createWarmSession() {
  const startedAt = Date.now()
  try {
    const session = createBrowserbaseSession()
    await session.init()
    const sessionId = session.browserbaseSessionID ?? "unknown"
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`[prewarm] Browserbase session ready: ${sessionId} (${seconds}s)`)
    giveSession(session)
  } catch (err) {
    learnFromError(err)
  } finally {
    warming = Math.max(0, warming - 1)
    if (!prewarmEnabled()) return

    const delay = Math.max(1000, cooldownUntil - Date.now())
    scheduleFillPool(delay)
  }
}

function waitForWarmSession(timeoutMs = warmSessionWaitMs()) {
  return new Promise<V3 | null>((resolve) => {
    const waiter: Waiter = {
      resolve,
      timeout: setTimeout(() => {
        waiters = waiters.filter(item => item !== waiter)
        resolve(null)
      }, timeoutMs),
    }
    waiters.push(waiter)
  })
}

export function startSessionPrewarm() {
  if (started || !prewarmEnabled()) return
  started = true
  fillPool()
}

export async function acquireBrowserbaseSession() {
  if (authFailureReason) {
    throw new Error(`${authFailureReason}. Check BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID in .env.`)
  }

  startSessionPrewarm()

  const warmSession = pool.shift()
  if (warmSession) {
    leased += 1
    fillPool()
    return warmSession
  }

  const waitedSession = prewarmConfigured() && warming > 0 ? await waitForWarmSession() : null
  if (authFailureReason) {
    throw new Error(`${authFailureReason}. Check BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID in .env.`)
  }

  if (waitedSession) {
    fillPool()
    return waitedSession
  }

  const session = createBrowserbaseSession()
  try {
    await session.init()
  } catch (err) {
    if (isAuthError(err)) {
      disableForAuthFailure(errorMessage(err))
    }
    throw err
  }
  leased += 1
  fillPool()
  return session
}

export function retireBrowserbaseSession() {
  leased = Math.max(0, leased - 1)
  fillPool()
}

export async function stopSessionPrewarm() {
  started = false
  if (fillTimer) {
    clearTimeout(fillTimer)
    fillTimer = null
  }
  resolveWaitersWithNull()

  const sessions = pool
  pool = []
  await Promise.allSettled(sessions.map(session => session.close()))
}
