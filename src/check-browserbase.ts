import Browserbase from "@browserbasehq/sdk"

const apiKey = process.env.BROWSERBASE_API_KEY
const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim()

function mask(value = "") {
  return value ? `${value.slice(0, 8)}...${value.slice(-6)}` : "(blank)"
}

if (!apiKey) {
  console.error("BROWSERBASE_API_KEY is missing.")
  process.exit(1)
}

if (!projectId) {
  console.error("BROWSERBASE_PROJECT_ID is missing. Set it to the Production project ID for this check.")
  process.exit(1)
}

const bb = new Browserbase({ apiKey })

try {
  const projects = await bb.projects.list()
  const project = projects.find(item => item.id === projectId)

  if (!project) {
    console.error(`Project ${mask(projectId)} is not visible to this API key.`)
    process.exit(1)
  }

  console.log(`Project visible: ${project.name} (${mask(project.id)}), concurrency=${project.concurrency}`)

  const session = await bb.sessions.create({
    projectId,
    userMetadata: { swarmWalletCheck: "true" },
  })

  console.log(`Session create OK: ${mask(session.id)} in project ${mask(session.projectId)}`)

  await bb.sessions.update(session.id, {
    projectId: session.projectId,
    status: "REQUEST_RELEASE",
  })
  console.log("Probe session released.")
} catch (err) {
  const status = (err as { status?: number }).status
  const message = err instanceof Error ? err.message : String(err)
  const apiMessage = (err as { error?: { message?: string } }).error?.message

  console.error(`Browserbase check failed${status ? ` (${status})` : ""}: ${message}`)
  if (apiMessage) console.error(`API message: ${apiMessage}`)
  process.exit(1)
}
