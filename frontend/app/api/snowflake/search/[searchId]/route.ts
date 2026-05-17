const BACKEND = process.env.BACKEND_HTTP_URL ?? "http://localhost:3001"

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ searchId: string }> }
) {
  const { searchId } = await context.params
  try {
    const res = await fetch(
      `${BACKEND}/snowflake/search/${encodeURIComponent(searchId)}`,
      { method: "DELETE" }
    )
    const body = await res.json()
    return Response.json(body, { status: res.status })
  } catch (err) {
    return Response.json(
      { error: `Backend unreachable at ${BACKEND}: ${String(err)}` },
      { status: 502 }
    )
  }
}
