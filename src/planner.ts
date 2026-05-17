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

export const POPULAR_SITE_LIST = POPULAR_SITES.map(a => a.site)

export async function planSwarm(
  query: string,
  options: { allowedSites?: string[] } = {},
): Promise<SwarmPlan> {
  const allowed = options.allowedSites && options.allowedSites.length > 0
    ? new Set(options.allowedSites)
    : null
  let agents = allowed
    ? POPULAR_SITES.filter(a => allowed.has(a.site))
    : POPULAR_SITES
  let reasoning = allowed
    ? `filtered to ${agents.length} sites selected by the user`
    : "default popular retail sites"

  // Snowflake: semantic site routing when memory exists, else reliability re-rank.
  if (isSnowflakeEnabled()) {
    const boosted = await getPlannerSiteBoost(query, agents)
    agents = boosted.agents
    reasoning = allowed
      ? `${reasoning}; ${boosted.reasoning}`
      : boosted.reasoning
  }

  return {
    product: query,
    category: "general",
    agents,
    reasoning,
  }
}
