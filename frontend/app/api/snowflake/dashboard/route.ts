const BACKEND = process.env.BACKEND_HTTP_URL ?? "http://localhost:3001"

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/snowflake/dashboard`, {
      cache: "no-store",
    })
    const body = await res.json()
    return Response.json(body, { status: res.status })
  } catch (err) {
    return Response.json(
      { error: `Backend unreachable at ${BACKEND}: ${String(err)}` },
      { status: 502 }
    )
  }
}
