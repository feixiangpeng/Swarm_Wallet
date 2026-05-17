import OpenAI from "openai"

const wafer = new OpenAI({
  baseURL: "https://pass.wafer.ai/v1",
  apiKey: process.env.WAFER_API_KEY,
})

export interface AgentPlan {
  site: string
  role: "price" | "reviews" | "deals"
  strategy: string
}

export interface SwarmPlan {
  product: string
  category: string
  agents: AgentPlan[]
  reasoning: string
}

export async function planSwarm(query: string): Promise<SwarmPlan> {
  const res = await wafer.chat.completions.create({
    model: "qwen3.6-max-preview",
    messages: [
      {
        role: "system",
        content: `You are a purchase intelligence planner.
Given a product query, return which sites to search and what role each agent plays.
Think purely about where this product is sold and where deals and reviews appear.
Return ONLY valid JSON. No markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Query: "${query}"

Return:
{
  "product": "normalized product name",
  "category": "product category",
  "agents": [
    {
      "site": "amazon.com",
      "role": "price",
      "strategy": "search for the product, sort by price low to high, extract the top 3 listings with price, stock status, and seller name"
    }
  ],
  "reasoning": "why these sites"
}

Cover all relevant angles:
- Every major retailer where this product sells (price agents)
- The best review source for this category (reviews agent)
- Where deals and coupons surface: slickdeals, camelcamelcamel, relevant reddit subs (deals agents)

Think broadly. A GPU search should cover newegg, amazon, microcenter, bhphoto,
adorama, reddit/buildapcsales, rtings. Vintage denim should cover ebay, depop,
grailed, poshmark, therealreal. Return as many agents as the product warrants.`,
      },
    ],
  })

  const text = res.choices[0].message.content ?? ""
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}
