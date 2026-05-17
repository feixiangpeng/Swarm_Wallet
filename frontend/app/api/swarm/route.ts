// TODO: WebSocket upgrade handler for Vercel
// Vercel doesn't support raw WebSocket upgrades in App Router — use a custom server
// or migrate to Vercel's `@vercel/edge` with Server-Sent Events, or deploy the
// backend (src/server.ts) separately (Railway, Render, Fly.io) and point
// NEXT_PUBLIC_WS_URL at it.

export async function GET() {
  return new Response("WebSocket endpoint — connect via ws://", { status: 200 })
}
