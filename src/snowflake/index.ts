export { isSnowflakeEnabled, snowflakeConfig } from "./config"
export { execute, executeOne, getConnection, resetConnection } from "./client"
export { migrateSnowflakeSchema } from "./migrate"
export {
  recordSearchStart,
  recordAgentEvent,
  persistSearchComplete,
  persistSearchError,
  snowflakeAsync,
} from "./persist"
export {
  buildIntelligenceContext,
  detectOutliers,
  emptyIntelligenceContext,
  getPlannerSiteBoost,
  getSiteReliability,
} from "./intelligence"
export {
  embedCompletedSearch,
  findSimilarSearches,
  findSitesFromSimilarSearches,
  isSemanticSearchEnabled,
  loadSemanticPriceHistory,
} from "./semantic"
export type { SemanticSiteScore, SimilarSearch } from "./semantic"
export { fetchSnowflakeDashboard } from "./dashboard"
export type { SnowflakeDashboard } from "./dashboard"
export { deleteSearch } from "./delete"
export type { DeleteSearchResult } from "./delete"
export { productKey } from "./normalize"
export type {
  IntelligenceContext,
  PersistedSearchResult,
  SiteReliabilityRow,
  WarehouseInsights,
} from "./types"
