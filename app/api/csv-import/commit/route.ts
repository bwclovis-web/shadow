import { NextRequest, NextResponse } from "next/server"

import { parseCsvCommitRequestRows } from "@/lib/csv-import-commit"
import { prisma } from "@/lib/db"
import { addUserPerfume } from "@/models/user.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"

const CSV_COMMIT_RATE_LIMIT_MAX = 5
const CSV_COMMIT_RATE_LIMIT_WINDOW_MS = 60 * 1000

export const POST = async (request: NextRequest) => {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const user = authResult.user!
    const body = await request.json().catch(() => null)
    await requireCSRFForJsonBody(request, body)

    try {
      await validateRateLimit(
        `csv-import-commit:user:${user.id}`,
        CSV_COMMIT_RATE_LIMIT_MAX,
        CSV_COMMIT_RATE_LIMIT_WINDOW_MS
      )
    } catch (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) {
        return rateLimitResponse
      }
      throw rateLimitResponse
    }

    const parsed = parseCsvCommitRequestRows(body)
    if ("error" in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const { rows } = parsed

    for (const row of rows) {
      if (!isValidPrismaRecordId(row.perfumeId)) {
        return NextResponse.json(
          { success: false, error: "Invalid perfume ID format" },
          { status: 400 }
        )
      }
    }

    const existing = await prisma.userPerfume.findMany({
      where: { userId: user.id },
      select: { perfumeId: true },
    })
    const existingPerfumeIds = new Set(existing.map(e => e.perfumeId))

    let committed = 0
    let skipped = 0
    const errors: { rowIndex: number; error: string }[] = []

    for (const row of rows) {
      if (existingPerfumeIds.has(row.perfumeId)) {
        skipped++
        continue
      }

      const result = await addUserPerfume({
        userId: user.id,
        perfumeId: row.perfumeId,
        amount: row.amount,
        ...(row.condition && { condition: row.condition }),
        tradePreference: row.tradePreference,
      })

      if (!result.success) {
        errors.push({
          rowIndex: row.rowIndex,
          error: result.error ?? "Failed to add perfume",
        })
        continue
      }

      existingPerfumeIds.add(row.perfumeId)
      committed++
    }

    return NextResponse.json({
      success: true,
      committed,
      skipped,
      errors,
    })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("[api/csv-import/commit]", error)
    return NextResponse.json(
      { success: false, error: "Failed to import rows" },
      { status: 500 }
    )
  }
}
