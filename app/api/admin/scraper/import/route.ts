/**
 * POST /api/admin/scraper/import
 *
 * Step 2 of the scraper flow: commit previously extracted records to the database.
 * Called only after the user has reviewed the scrape results and clicked "Confirm & Import".
 *
 * 1. Imports each PerfumeCsvRecord into the DB via the shared import lib.
 * 2. Optionally uploads each perfume image to Cloudflare R2: any image URL not already
 *    from our R2 bucket is fetched, uploaded to R2, and the DB record updated (overwrite).
 *
 * Requires admin or editor role.
 */

import { revalidatePath } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"

import { prisma } from "@/lib/db"
import { importPerfumeRecords } from "@/lib/import-perfume-csv"
import { assessDuplicateRisk } from "@/lib/scraper/duplicate-review"
import { stripPreviewFields } from "@/lib/scraper/strip-preview-fields"
import { checkR2BucketExists } from "@/lib/r2"
import { migratePerfumeImageToR2 } from "@/lib/r2-migrate"
import type {
  PerfumeCsvRecord,
  ScraperImportRequest,
  ScraperImportResponse,
} from "@/types/scraper"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import {
  revalidateHouseDataCache,
  revalidatePerfumeDataCache,
} from "@/utils/server/revalidate-catalog-cache.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

/** Allow long imports when R2 migration runs for many products (align with scraper run). */
export const maxDuration = 300

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateBody(body: unknown): body is ScraperImportRequest {
  if (!body || typeof body !== "object") return false
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.records) || typeof b.uploadImagesToR2 !== "boolean") return false
  if (b.overwriteImageUrls !== undefined && typeof b.overwriteImageUrls !== "boolean") return false
  return true
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
    body = JSON.parse(await request.text()) as unknown
  } catch {
    return NextResponse.json(
      { ok: false, importedCount: 0, r2UploadCount: 0, errors: ["Invalid JSON body"] } satisfies ScraperImportResponse,
      { status: 400 },
    )
  }

  try {
    await requireCSRFForJsonBody(request, body)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json(
        {
          ok: false,
          importedCount: 0,
          r2UploadCount: 0,
          errors: [error.message],
        } satisfies ScraperImportResponse,
        { status: 403 },
      )
    }
    throw error
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
  const allowHighDuplicateRisk = body.allowHighDuplicateRisk === true
  const withDuplicateFlags = await assessDuplicateRisk(validRecords, { prismaClient: prisma })
  const skippedDuplicateRiskCount = withDuplicateFlags.filter(
    r => r.duplicateRisk === "high" && !allowHighDuplicateRisk,
  ).length
  const recordsToImport = withDuplicateFlags
    .filter(r => r.duplicateRisk !== "high" || allowHighDuplicateRisk)
    .map(stripPreviewFields)

  if (recordsToImport.length === 0) {
    const msg =
      skippedDuplicateRiskCount > 0
        ? `All ${validRecords.length} record(s) skipped due to high duplicate risk. Enable "Import possible duplicates" to proceed.`
        : "No valid records to import"
    return NextResponse.json(
      {
        ok: false,
        importedCount: 0,
        r2UploadCount: 0,
        errors: [msg],
        skippedDuplicateRiskCount: skippedDuplicateRiskCount || undefined,
      } satisfies ScraperImportResponse,
      { status: 400 },
    )
  }

  const errors: string[] = []
  const failedR2Names: string[] = []
  let importedCount = 0
  let r2UploadCount = 0

  // Step 1: Import records to DB
  const overwriteImageUrls = body.overwriteImageUrls !== false
  const summary = await importPerfumeRecords(recordsToImport, {
    prismaClient: prisma,
    overwriteImageUrls,
  })
  importedCount = summary.successful.length
  summary.errors.forEach(e => errors.push(`Import (${e.record.name}): ${e.error}`))

  // Step 2: Optional R2 image upload — for all successfully imported records.
  // migratePerfumeImageToR2 skips any image already on R2, so it is safe to run on all records.
  const idsForR2 = summary.successful.map(r => r.id)
  if (body.uploadImagesToR2 && idsForR2.length > 0) {
    const bucketCheck = await checkR2BucketExists()
    if (!bucketCheck.ok) {
      errors.push(bucketCheck.error)
    } else {
      const ids = idsForR2
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
              failedR2Names.push(name)
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.toLowerCase().includes(bucketNotExistMessage) && !bucketErrorShown) {
            errors.push(`R2: ${msg}`)
            bucketErrorShown = true
          } else if (!msg.toLowerCase().includes(bucketNotExistMessage)) {
            errors.push(`R2 upload (${name}): ${msg}`)
            failedR2Names.push(name)
          }
        }
      }
    }
  }

  // Bust house/perfume data caches so existing-house pages show fresh imports.
  if (importedCount > 0 || r2UploadCount > 0) {
    revalidatePerfumeDataCache()
    revalidateHouseDataCache()

    const houseNames = [
      ...new Set(
        recordsToImport
          .map(r => r.perfumeHouse?.trim())
          .filter((n): n is string => Boolean(n)),
      ),
    ]
    if (houseNames.length > 0) {
      const houses = await prisma.perfumeHouse.findMany({
        where: { name: { in: houseNames } },
        select: { slug: true },
      })
      revalidatePath("/houses")
      for (const { slug } of houses) {
        if (slug) revalidatePath(`/houses/${slug}`)
      }
    }

    const perfumeSlugs = await prisma.perfume.findMany({
      where: { id: { in: summary.successful.map(r => r.id) } },
      select: { slug: true },
    })
    for (const { slug } of perfumeSlugs) {
      if (slug) revalidatePath(`/perfume/${slug}`)
    }
  }

  return NextResponse.json({
    ok: true,
    importedCount,
    r2UploadCount,
    errors,
    failedR2Names,
    skippedDuplicateRiskCount: skippedDuplicateRiskCount > 0 ? skippedDuplicateRiskCount : undefined,
  } satisfies ScraperImportResponse)
}
