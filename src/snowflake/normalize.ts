/** Stable key for cross-search price history in Snowflake. */
export function productKey(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 256)
}

export function siteFromSource(source: string): string {
  const s = source.toLowerCase().replace(/^www\./, "")
  if (s.includes("amazon")) return "amazon.com"
  if (s.includes("bestbuy") || s.includes("best buy")) return "bestbuy.com"
  if (s.includes("walmart")) return "walmart.com"
  if (s.includes("target")) return "target.com"
  if (s.includes("newegg")) return "newegg.com"
  if (s.includes("ebay")) return "ebay.com"
  if (s.includes("etsy")) return "etsy.com"
  return s.split("/")[0] ?? s
}
