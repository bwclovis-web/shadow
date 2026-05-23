import { revalidatePath, revalidateTag } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"

const getSecret = () => process.env.SANITY_REVALIDATE_SECRET ?? ""

/** Next.js 16+ requires a cache life profile for `revalidateTag`. */
const REVALIDATE_PROFILE = "max" as const

/** Sanity webhook or manual POST to refresh cached article pages. */
export const POST = async (request: NextRequest) => {
  const secret = getSecret()
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "SANITY_REVALIDATE_SECRET is not configured" },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: { slug?: string } = {}
  try {
    body = (await request.json()) as { slug?: string }
  } catch {
    body = {}
  }

  revalidateTag("articles", REVALIDATE_PROFILE)
  revalidatePath("/journal")

  if (body.slug) {
    revalidateTag(`article:${body.slug}`, REVALIDATE_PROFILE)
    revalidatePath(`/journal/${body.slug}`)
  }

  return NextResponse.json({ ok: true, revalidated: true })
}
