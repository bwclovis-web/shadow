/**
 * POST /api/admin/scraper/preview-user-import
 * Convert user CSV / Fragrantica / Parfumo rows into scraper preview records.
 */

import { NextResponse, type NextRequest } from "next/server"

import { assessDuplicateRisk } from "@/lib/scraper/duplicate-review"
import { userImportRowsToPreviewRecords } from "@/lib/scraper/user-import-pipeline"
import { prisma } from "@/lib/db"
import type { ScraperUserImportRequest } from "@/types/scraper"
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

  const req = body as ScraperUserImportRequest
  if (!Array.isArray(req.rows) || req.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "rows array required" }, { status: 400 })
  }

  const preview = userImportRowsToPreviewRecords(req.rows)
  const records = await assessDuplicateRisk(preview, { prismaClient: prisma })

  return NextResponse.json({
    ok: true,
    scrapedCount: records.length,
    records,
  })
}
