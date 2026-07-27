/**
 * POST /api/admin/scraper/detect — probe a collection URL for platform, captcha, selectors.
 */

import { NextResponse, type NextRequest } from "next/server"

import { detectScraperFromCollectionUrl } from "@/lib/scraper/detect-platform"
import { prisma } from "@/lib/db"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  let body: unknown
  try {
    body = JSON.parse(await request.text()) as unknown
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  try {
    await requireCSRFForJsonBody(request, body)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 })
    }
    throw error
  }

  const b = body as Record<string, unknown>
  const collectionUrl = typeof b.collectionUrl === "string" ? b.collectionUrl.trim() : ""
  if (!collectionUrl) {
    return NextResponse.json({ ok: false, error: "collectionUrl is required" }, { status: 400 })
  }
  const sampleProductUrl =
    typeof b.sampleProductUrl === "string" ? b.sampleProductUrl.trim() : undefined

  const result = await detectScraperFromCollectionUrl(collectionUrl, { sampleProductUrl })
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }

  let matchedHouseName: string | null = null
  if (result.suggestedHouseName) {
    const house = await prisma.perfumeHouse.findFirst({
      where: { name: { equals: result.suggestedHouseName, mode: "insensitive" } },
      select: { name: true },
    })
    if (house) matchedHouseName = house.name
  }
  if (!matchedHouseName && result.baseUrl) {
    const bySite = await prisma.perfumeHouse.findFirst({
      where: { website: { contains: new URL(result.baseUrl).hostname, mode: "insensitive" } },
      select: { name: true },
    })
    if (bySite) matchedHouseName = bySite.name
  }

  return NextResponse.json({
    ...result,
    /** Existing DB house name when matched; otherwise the site-derived suggestion. */
    suggestedHouseName: matchedHouseName ?? result.suggestedHouseName,
    /** True when suggestedHouseName resolved to an existing perfume house. */
    houseMatched: matchedHouseName != null,
  })
}
