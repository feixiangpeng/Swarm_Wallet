import { getPlannerSiteBoost, isSnowflakeEnabled } from "./snowflake/index"

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

const POPULAR_SITES: AgentPlan[] = [
  {
    site: "amazon.com",
    role: "price",
    strategy: "search for the product, sort by price low to high, extract the top listing with price, stock status, and seller name",
  },
  {
    site: "bestbuy.com",
    role: "price",
    strategy: "search for the product, extract the top listing with price, availability, and any open-box deals",
  },
  {
    site: "target.com",
    role: "price",
    strategy: "search for the product, extract the top listing with price and availability",
  },
  {
    site: "walmart.com",
    role: "price",
    strategy: "search for the product, sort by price low to high, extract the top listing with price and availability",
  },
  {
    site: "ebay.com",
    role: "price",
    strategy: "search for the product, filter to Buy It Now, sort by price + shipping lowest first, extract the top listing",
  },
  {
    site: "etsy.com",
    role: "price",
    strategy: "search for the product, sort by relevancy, extract the top listing with price, seller name, and shipping estimate",
  },
]

export async function planSwarm(query: string): Promise<SwarmPlan> {
  let agents = POPULAR_SITES
  let reasoning = "default popular retail sites"

  if (isSnowflakeEnabled()) {
    const boosted = await getPlannerSiteBoost(query, POPULAR_SITES)
    agents = boosted.agents
    reasoning = boosted.reasoning
  }

  return {
    product: query,
    category: "general",
    agents,
    reasoning,
  }
}
