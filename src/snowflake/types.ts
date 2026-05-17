import type { Finding } from "../agent"
import type { Verdict } from "../coordinator"
import type { SwarmPlan } from "../planner"

export interface SimilarSearchMatch {
  query_text: string
  product_key: string
  similarity: number
}

export interface WarehouseInsights {
  timing_signal: string
  price_history: {
    observation_count: number
    min_price_90d: number | null
    max_price_90d: number | null
    avg_price_90d: number | null
    days_of_history: number
  }
  outliers: Array<{ source: string; site: string; price: number; reason: string }>
  collective_hint: string | null
  best_historical_site: string | null
  /** Populated when Cortex semantic search finds related past queries */
  similar_searches?: SimilarSearchMatch[]
  semantic_search_enabled?: boolean
}

export interface SiteReliabilityRow {
  site: string
  role: string
  success_rate: number
  sample_size: number
}

export interface IntelligenceContext {
  insights: WarehouseInsights
  planner_hint: string | null
  site_reliability: SiteReliabilityRow[]
}

export interface PersistedSearchResult {
  searchId: string
  query: string
  plan: SwarmPlan
  findings: Finding[]
  verdict: Verdict
  replayUrls: Record<string, string>
  startedAt: number
  completedAt: number
}
