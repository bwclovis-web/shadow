import { NextResponse, type NextRequest } from "next/server"
import { PrismaClient } from "@prisma/client"

import { checkR2BucketExists } from "@/lib/r2"
import { migratePerfumeImageToR2 } from "@/lib/r2-migrate"
import type {
  PerfumeCsvRecord,
  ScraperRetryR2Request,
  ScraperRetryR2Response,
} from "@/types/scraper"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

function validateBody(body: unknown): body is ScraperRetryR2Request {
  if (!body || typeof body !== "object") return false
  const b = body as Record<string, unknown>
  return Array.isArray(b.records)
}

function normalize(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase()
}

function isValidRecord(r: unknown): r is PerfumeCsvRecord {
  if (!r || typeof r !== "object") return false
  const rec = r as Record<string, unknown>
  return typeof rec.name === "string" && rec.name.trim().length > 0
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        ok: false,
        attemptedCount: 0,
        uploadedCount: 0,
        skippedCount: 0,
        errors: ["Invalid JSON body"],
      } satisfies ScraperRetryR2Response,
      { status: 400 },
    )
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      {
        ok: false,
        attemptedCount: 0,
        uploadedCount: 0,
        skippedCount: 0,
        errors: ["Body must contain records (array)"],
      } satisfies ScraperRetryR2Response,
      { status: 400 },
    )
  }

  const validRecords = (body.records as unknown[]).filter(isValidRecord)
  if (validRecords.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        attemptedCount: 0,
        uploadedCount: 0,
        skippedCount: 0,
        errors: ["No valid records to retry"],
      } satisfies ScraperRetryR2Response,
      { status: 400 },
    )
  }

  const nameSet = new Set(validRecords.map(r => r.name.trim()).filter(Boolean))
  const wantedPairs = new Set(
    validRecords.map(r => `${normalize(r.name)}|${normalize(r.perfumeHouse)}`),
  )

  const errors: string[] = []
  const failedR2Names: string[] = []
  let attemptedCount = 0
  let uploadedCount = 0
  let skippedCount = 0

  const prisma = new PrismaClient()
  try {
    const bucketCheck = await checkR2BucketExists()
    if (!bucketCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          attemptedCount: 0,
          uploadedCount: 0,
          skippedCount: 0,
          errors: [bucketCheck.error],
        } satisfies ScraperRetryR2Response,
        { status: 400 },
      )
    }

    const candidates = await prisma.perfume.findMany({
      where: { name: { in: [...nameSet] } },
      select: {
        id: true,
        name: true,
        image: true,
        perfumeHouse: { select: { name: true } },
      },
    })

    const perfumes = candidates.filter(p => {
      const key = `${normalize(p.name)}|${normalize(p.perfumeHouse?.name)}`
      return wantedPairs.has(key) || wantedPairs.has(`${normalize(p.name)}|`)
    })

    if (perfumes.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          attemptedCount: 0,
          uploadedCount: 0,
          skippedCount: 0,
          errors: ["No matching imported perfumes found for retry"],
        } satisfies ScraperRetryR2Response,
        { status: 404 },
      )
    }

    for (const { id, name, image } of perfumes) {
      if (!image) {
        skippedCount++
        continue
      }
      attemptedCount++
      const result = await migratePerfumeImageToR2(id, image, { prismaClient: prisma })
      if (result.ok) {
        if (result.skipped) skippedCount++
        else uploadedCount++
        continue
      }
      errors.push(`R2 upload (${name}): ${result.error}`)
      failedR2Names.push(name)
    }
  } finally {
    await prisma.$disconnect()
  }

  return NextResponse.json({
    ok: true,
    attemptedCount,
    uploadedCount,
    skippedCount,
    errors,
    failedR2Names,
  } satisfies ScraperRetryR2Response)
}
