import OpenAI from "openai"
import type { Finding } from "./agent"

const wafer = new OpenAI({
  baseURL: "https://pass.wafer.ai/v1",
  apiKey: process.env.WAFER_API_KEY,
})

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
}

export async function synthesize(query: string, findings: Finding[]): Promise<Verdict> {
  const res = await wafer.chat.completions.create({
    model: "qwen3.6-max-preview",
    messages: [{
      role: "user",
      content: `Shopping goal: "${query}"

${findings.length} agents returned:
${JSON.stringify(findings, null, 2)}

Synthesize a final purchase recommendation. Return ONLY valid JSON:
{
  "recommendation": "2-3 sentence verdict",
  "top_picks": [
    { "rank": 1, "name": "...", "price": "$X", "source": "...", "why": "..." }
  ],
  "caution": "one watch-out",
  "timing": "buy now or wait, and why"
}`,
    }],
  })

  const text = res.choices[0].message.content ?? ""
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}
