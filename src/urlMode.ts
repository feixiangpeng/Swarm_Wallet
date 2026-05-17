// URL-mode helpers: when the user pastes a product URL instead of typing a
// query, we fetch the page server-side, pull out a product name from the
// `<title>`, and feed that into the normal swarm flow.

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i
const META_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i

const SEPARATORS = [
  " | ", " - ", " — ", " – ", " :: ", " // ",
]

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripSiteName(title: string, host: string): string {
  // Most product pages have titles like "Sony WH-1000XM5 Headphones | Amazon".
  // Pick the longest segment that doesn't contain the site's brand name.
  const brand = host.replace(/^www\./, "").split(".")[0].toLowerCase()
  let best = title
  for (const sep of SEPARATORS) {
    if (!title.includes(sep)) continue
    const parts = title.split(sep).map(p => p.trim()).filter(Boolean)
    const filtered = parts.filter(p => !p.toLowerCase().includes(brand))
    const candidate = (filtered.length > 0 ? filtered : parts)
      .sort((a, b) => b.length - a.length)[0]
    if (candidate && candidate.length > 3) {
      best = candidate
      break
    }
  }
  return best.trim()
}

export function isLikelyUrl(input: string): boolean {
  const trimmed = input.trim()
  if (/\s/.test(trimmed)) return false
  return /^https?:\/\//i.test(trimmed)
}

export async function resolveQueryFromUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // Some retailers block default UAs; mimic a desktop browser.
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`URL fetch failed (${res.status})`)
  // Read at most ~256KB — the title/meta tags are always in the head.
  const reader = res.body?.getReader()
  if (!reader) throw new Error("URL fetch returned no body")
  const chunks: Uint8Array[] = []
  let total = 0
  const limit = 256 * 1024
  while (total < limit) {
    const { value, done } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  await reader.cancel().catch(() => {})
  const html = new TextDecoder().decode(Buffer.concat(chunks.map(c => Buffer.from(c))))

  const ogMatch = META_RE.exec(html)
  const raw = ogMatch?.[1] ?? TITLE_RE.exec(html)?.[1]
  if (!raw) throw new Error("could not find a product title on the page")

  const host = new URL(url).host
  return stripSiteName(decodeEntities(raw), host)
}
