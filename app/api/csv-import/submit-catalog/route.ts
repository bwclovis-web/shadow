import { NextRequest, NextResponse } from "next/server"

import {
  buildCsvHouseSubmissionData,
  buildCsvPerfumeSubmissionData,
  normalizeHouseKey,
  parseCsvSubmitCatalogRows,
  type CsvSubmitCatalogResponseBody,
} from "@/lib/csv-import-pending-submission"
import { getPerfumeHouseByName } from "@/models/house.server"
import {
  createAdminAlertsForPendingSubmission,
  createPendingSubmission,
} from "@/models/pending-submission.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"

const CSV_SUBMIT_CATALOG_RATE_LIMIT_MAX = 5
const CSV_SUBMIT_CATALOG_RATE_LIMIT_WINDOW_MS = 60 * 1000
const PENDING_SUBMISSION_WINDOW_MS = 60 * 60 * 1000
const PENDING_SUBMISSION_MAX_PER_HOUR = 20

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
        `csv-import-submit-catalog:user:${user.id}`,
        CSV_SUBMIT_CATALOG_RATE_LIMIT_MAX,
        CSV_SUBMIT_CATALOG_RATE_LIMIT_WINDOW_MS
      )
      await validateRateLimit(
        `pending-submission:user:${user.id}`,
        PENDING_SUBMISSION_MAX_PER_HOUR,
        PENDING_SUBMISSION_WINDOW_MS
      )
    } catch (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) {
        return rateLimitResponse
      }
      throw rateLimitResponse
    }

    const parsed = parseCsvSubmitCatalogRows(body)
    if ("error" in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const { rows } = parsed
    const housePendingByKey = new Map<string, string>()
    let houseSubmissionsCreated = 0
    let submitted = 0
    const errors: { rowIndex: number; error: string }[] = []

    for (const row of rows) {
      try {
        const houseKey = normalizeHouseKey(row.house)
        let houseId: string | undefined
        let pendingHouseSubmissionId: string | undefined

        const existingHouse = await getPerfumeHouseByName(row.house)
        if (existingHouse) {
          houseId = existingHouse.id
        } else {
          let linkedHousePendingId = housePendingByKey.get(houseKey)
          if (!linkedHousePendingId) {
            const houseData = buildCsvHouseSubmissionData(row.house)
            const houseSubmission = await createPendingSubmission(
              "perfume_house",
              houseData,
              user.id
            )
            linkedHousePendingId = houseSubmission.id
            housePendingByKey.set(houseKey, linkedHousePendingId)
            houseSubmissionsCreated++
            await createAdminAlertsForPendingSubmission(
              houseSubmission.id,
              "perfume_house",
              houseData
            )
          }
          pendingHouseSubmissionId = linkedHousePendingId
        }

        const perfumeData = buildCsvPerfumeSubmissionData(row, {
          houseId,
          pendingHouseSubmissionId,
        })
        const perfumeSubmission = await createPendingSubmission(
          "perfume",
          perfumeData,
          user.id
        )
        await createAdminAlertsForPendingSubmission(
          perfumeSubmission.id,
          "perfume",
          perfumeData
        )
        submitted++
      } catch (err) {
        errors.push({
          rowIndex: row.rowIndex,
          error: err instanceof Error ? err.message : "Failed to submit row",
        })
      }
    }

    const response: CsvSubmitCatalogResponseBody = {
      success: true,
      submitted,
      houseSubmissionsCreated,
      errors,
    }
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("[api/csv-import/submit-catalog]", error)
    return NextResponse.json(
      { success: false, error: "Failed to submit rows to catalog" },
      { status: 500 }
    )
  }
}
