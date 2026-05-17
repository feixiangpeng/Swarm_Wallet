import Browserbase from "@browserbasehq/sdk"

const apiKey = process.env.BROWSERBASE_API_KEY
const projectId = process.env.BROWSERBASE_PROJECT_ID

if (!apiKey || !projectId) {
  throw new Error("BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID are required")
}

const bb = new Browserbase({ apiKey })
const context = await bb.contexts.create({ projectId })
const session = await bb.sessions.create({
  projectId,
  browserSettings: {
    context: { id: context.id, persist: true },
    solveCaptchas: true,
    blockAds: true,
    os: "mac",
  },
  proxies: [{ type: "browserbase", geolocation: { country: "US" } }],
})
const debug = await bb.sessions.debug(session.id)

console.log("Browserbase context created.")
console.log(`BROWSERBASE_CONTEXT_ID=${context.id}`)
console.log("")
console.log("Open this URL, log into any sites you want persisted, then close it:")
console.log(debug.debuggerFullscreenUrl)
