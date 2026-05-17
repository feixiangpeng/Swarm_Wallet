const BACKEND = process.env.BACKEND_HTTP_URL ?? "http://localhost:3001"

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/health`, { cache: "no-store" })
    const body = await res.json()
    return Response.json(body, { status: res.status })
  } catch {
    return Response.json({ ok: false, snowflake: false, backend: false }, { status: 502 })
  }
}
