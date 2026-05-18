/**
 * GET /api/admin/scraper/sources — list saved presets
 * POST /api/admin/scraper/sources — save current form as preset
 */

import { NextResponse, type NextRequest } from "next/server"

import { prisma } from "@/lib/db"
import type { ScraperConfig, ScraperSourcePreset } from "@/types/scraper"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

const toPreset = (row: {
  id: string
  houseName: string
  baseUrl: string | null
  platformType: string | null
  configJson: unknown
  status: string
  lastRunAt: Date | null
  lastDiscoveredCount: number | null
  lastScrapedCount: number | null
  createdAt: Date
  updatedAt: Date
}): ScraperSourcePreset => ({
  id: row.id,
  houseName: row.houseName,
  baseUrl: row.baseUrl,
  platformType: row.platformType,
  configJson: row.configJson as ScraperConfig,
  status: row.status,
  lastRunAt: row.lastRunAt?.toISOString() ?? null,
  lastDiscoveredCount: row.lastDiscoveredCount,
  lastScrapedCount: row.lastScrapedCount,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  const rows = await prisma.scraperSource.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  })

  return NextResponse.json({ ok: true, sources: rows.map(toPreset) })
}

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
  const config = b.config as ScraperConfig | undefined
  if (!config?.houseName?.trim()) {
    return NextResponse.json({ ok: false, error: "config.houseName required" }, { status: 400 })
  }

  const row = await prisma.scraperSource.create({
    data: {
      houseName: config.houseName.trim(),
      baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : null,
      platformType: typeof b.platformType === "string" ? b.platformType : null,
      configJson: config as object,
      status: "active",
    },
  })

  return NextResponse.json({ ok: true, source: toPreset(row) })
}
