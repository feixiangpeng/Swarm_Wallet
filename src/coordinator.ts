import OpenAI from "openai"
import type { Finding } from "./agent"
import type { IntelligenceContext, WarehouseInsights } from "./snowflake/types"

const wafer = new OpenAI({
  baseURL: "https://pass.wafer.ai/v1",
  apiKey: process.env.WAFER_API_KEY,
})

export type { WarehouseInsights }

export interface Verdict {
  recommendation: string
  top_picks: Array<{
    rank: number
    name: string
    price: string
    source: string
    why: string
  }>
  caution: string
  timing: string
  warehouse_insights?: WarehouseInsights
}

function stripThinking(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```json|```/g, "")
    .trim()
}

export async function synthesize(
  query: string,
  findings: Finding[],
  intelligence?: IntelligenceContext
): Promise<Verdict> {
  const insights = intelligence?.insights
  const warehouseBlock = insights
    ? `
Snowflake warehouse facts (use these for timing — do not contradict):
- Timing signal: ${insights.timing_signal}
- 90-day observations: ${insights.price_history.observation_count}
- 90-day min/avg/max: ${insights.price_history.min_price_90d ?? "n/a"} / ${insights.price_history.avg_price_90d ?? "n/a"} / ${insights.price_history.max_price_90d ?? "n/a"}
- Collective hint: ${insights.collective_hint ?? "n/a"}
- Best historical site: ${insights.best_historical_site ?? "n/a"}
- Flagged outliers: ${insights.outliers.length ? JSON.stringify(insights.outliers) : "none"}
- Semantic search: ${insights.semantic_search_enabled ? "enabled" : "off"}
- Similar past queries: ${insights.similar_searches?.length ? JSON.stringify(insights.similar_searches) : "none"}
`
    : ""

  const res = await wafer.chat.completions.create({
    model: "qwen3.6-max-preview",
    messages: [{
      role: "user",
      content: `Shopping goal: "${query}"

${findings.length} agents returned:
${JSON.stringify(findings, null, 2)}
${warehouseBlock}

Synthesize a final purchase recommendation. The "timing" field must reflect the Snowflake timing signal when provided.
Return ONLY valid JSON:
{
  "recommendation": "2-3 sentence verdict",
  "top_picks": [
    { "rank": 1, "name": "...", "price": "$X", "source": "...", "why": "..." }
  ],
  "caution": "one watch-out (mention outlier deals if any)",
  "timing": "buy now or wait, and why"
}`,
    }],
  })

  const text = res.choices[0].message.content ?? ""
  const verdict = JSON.parse(stripThinking(text)) as Verdict

  if (insights) {
    verdict.warehouse_insights = insights
  }

  return verdict
}
