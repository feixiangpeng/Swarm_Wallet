import { V3 } from "@browserbasehq/stagehand"

export type { V3 }

export function createBrowserbaseSession() {
  return new V3({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    model: {
      modelName: "qwen3.6-max-preview",
      baseURL: "https://pass.wafer.ai/v1",
      apiKey: process.env.WAFER_API_KEY!,
    },
    verbose: 0,
    disablePino: true,
  })
}
