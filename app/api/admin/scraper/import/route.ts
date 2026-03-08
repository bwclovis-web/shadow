/**
 * POST /api/admin/scraper/import
 *
 * Step 2 of the scraper flow: commit previously extracted records to the database.
 * Called only after the user has reviewed the scrape results and clicked "Confirm & Import".
 *
 * 1. Imports each PerfumeCsvRecord into the DB via the shared import lib.
 * 2. Optionally uploads each perfume image to Cloudflare R2.
 *
 * Requires admin or editor role.
 */

import { NextResponse, type NextRequest } from "next/server"
import { PrismaClient } from "@prisma/client"

import { importPerfumeRecords } from "@/lib/import-perfume-csv"
import { checkR2BucketExists } from "@/lib/r2"
import { migratePerfumeImageToR2 } from "@/lib/r2-migrate"
import type {
  PerfumeCsvRecord,
  ScraperImportRequest,
  ScraperImportResponse,
} from "@/types/scraper"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateBody(body: unknown): body is ScraperImportRequest {
  if (!body || typeof body !== "object") return false
  const b = body as Record<string, unknown>
  return Array.isArray(b.records) && typeof b.uploadImagesToR2 === "boolean"
}

function isValidRecord(r: unknown): r is PerfumeCsvRecord {
  if (!r || typeof r !== "object") return false
  const rec = r as Record<string, unknown>
  return typeof rec.name === "string" && rec.name.trim().length > 0
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, importedCount: 0, r2UploadCount: 0, errors: ["Invalid JSON body"] } satisfies ScraperImportResponse,
      { status: 400 },
    )
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      {
        ok: false,
        importedCount: 0,
        r2UploadCount: 0,
        errors: ["Body must contain records (array) and uploadImagesToR2 (boolean)"],
      } satisfies ScraperImportResponse,
      { status: 400 },
    )
  }

  const validRecords = (body.records as unknown[]).filter(isValidRecord)

  if (validRecords.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        importedCount: 0,
        r2UploadCount: 0,
        errors: ["No valid records to import"],
      } satisfies ScraperImportResponse,
      { status: 400 },
    )
  }

  const errors: string[] = []
  let importedCount = 0
  let r2UploadCount = 0

  const prisma = new PrismaClient()
  try {
    // Step 1: Import records to DB
    const summary = await importPerfumeRecords(validRecords, { prismaClient: prisma })
    importedCount = summary.successful.length
    summary.errors.forEach(e => errors.push(`Import (${e.record.name}): ${e.error}`))

    // Step 2: Optional R2 image upload
    if (body.uploadImagesToR2 && summary.successful.length > 0) {
      const bucketCheck = await checkR2BucketExists()
      if (!bucketCheck.ok) {
        errors.push(bucketCheck.error)
      } else {
        const ids = summary.successful.map(r => r.id)
        const perfumes = await prisma.perfume.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, image: true },
        })

        const bucketNotExistMessage = "bucket does not exist"
        let bucketErrorShown = false

        for (const { id, name, image } of perfumes) {
          if (!image) continue
          try {
            const result = await migratePerfumeImageToR2(id, image, { prismaClient: prisma })
            if (result.ok && !result.skipped) r2UploadCount++
            else if (!result.ok) {
              if (result.error?.toLowerCase().includes(bucketNotExistMessage) && !bucketErrorShown) {
                errors.push(`R2: ${result.error}`)
                bucketErrorShown = true
              } else if (!result.error?.toLowerCase().includes(bucketNotExistMessage)) {
                errors.push(`R2 upload (${name}): ${result.error}`)
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            if (msg.toLowerCase().includes(bucketNotExistMessage) && !bucketErrorShown) {
              errors.push(`R2: ${msg}`)
              bucketErrorShown = true
            } else if (!msg.toLowerCase().includes(bucketNotExistMessage)) {
              errors.push(`R2 upload (${name}): ${msg}`)
            }
          }
        }
      }
    }
  } finally {
    await prisma.$disconnect()
  }

  return NextResponse.json({
    ok: true,
    importedCount,
    r2UploadCount,
    errors,
  } satisfies ScraperImportResponse)
}
