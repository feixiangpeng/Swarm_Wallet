import { CustomOpenAIClient, V3 } from "@browserbasehq/stagehand"
import OpenAI from "openai"

export type { V3 }

export function createBrowserbaseSession() {
  const modelName = "qwen3.6-max-preview"
  const contextId = process.env.BROWSERBASE_CONTEXT_ID
  const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim()
  const client = new OpenAI({
    baseURL: "https://pass.wafer.ai/v1",
    apiKey: process.env.WAFER_API_KEY!,
  })

  return new V3({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    ...(projectId ? { projectId } : {}),
    browserbaseSessionCreateParams: {
      browserSettings: {
        ...(contextId ? { context: { id: contextId, persist: true } } : {}),
        solveCaptchas: true,
        blockAds: true,
        fingerprint: {
          browsers: ["chrome"],
          devices: ["desktop"],
          operatingSystems: ["macos"],
        },
      },
      proxies: [{ type: "browserbase", geolocation: { country: "US" } }],
    },
    model: {
      modelName: `openai/${modelName}`,
      baseURL: "https://pass.wafer.ai/v1",
      apiKey: process.env.WAFER_API_KEY!,
    },
    llmClient: new CustomOpenAIClient({ modelName, client }),
    verbose: 0,
    disablePino: true,
    disableAPI: true,
  })
}
