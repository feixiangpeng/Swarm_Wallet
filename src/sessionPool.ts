import { createBrowserbaseSession, type V3 } from "./stagehand"

type Waiter = {
  resolve: (session: V3 | null) => void
  timeout: NodeJS.Timeout
}

const DEFAULT_PREWARM_TIMEOUT_MS = 5 * 60_000

let pool: V3[] = []
let waiters: Waiter[] = []
let warming = 0
let leased = 0
let started = false
let observedConcurrentLimit: number | null = null
let cooldownUntil = 0

function prewarmEnabled() {
  return process.env.PREWARM_BROWSERBASE !== "false"
}

function targetSize() {
  const configured = Number(
    process.env.PREWARM_BROWSERBASE_SESSIONS ??
    process.env.MAX_BROWSER_SESSIONS ??
    4
  )
  return observedConcurrentLimit == null
    ? configured
    : Math.min(configured, observedConcurrentLimit)
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return String(err)
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

function fillPool() {
  if (!prewarmEnabled()) return
  if (Date.now() < cooldownUntil) {
    setTimeout(fillPool, cooldownUntil - Date.now())
    return
  }

  const target = Math.max(0, targetSize())
  if (pool.length + warming + leased < target) {
    warming += 1
    void createWarmSession()
  }
}

async function createWarmSession() {
  try {
    const session = createBrowserbaseSession()
    await session.init()
    const sessionId = session.browserbaseSessionID ?? "unknown"
    console.log(`[prewarm] Browserbase session ready: ${sessionId}`)
    giveSession(session)
  } catch (err) {
    learnFromError(err)
  } finally {
    warming = Math.max(0, warming - 1)
    const delay = Math.max(1000, cooldownUntil - Date.now())
    setTimeout(fillPool, delay)
  }
}

function waitForWarmSession(timeoutMs = DEFAULT_PREWARM_TIMEOUT_MS) {
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
  startSessionPrewarm()

  const warmSession = pool.shift()
  if (warmSession) {
    leased += 1
    fillPool()
    return warmSession
  }

  const waitedSession = prewarmEnabled() ? await waitForWarmSession() : null
  if (waitedSession) {
    fillPool()
    return waitedSession
  }

  const session = createBrowserbaseSession()
  await session.init()
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
  for (const waiter of waiters) {
    clearTimeout(waiter.timeout)
    waiter.resolve(null)
  }
  waiters = []

  const sessions = pool
  pool = []
  await Promise.allSettled(sessions.map(session => session.close()))
}
