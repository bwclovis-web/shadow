import { NextRequest, NextResponse } from "next/server"
import { parseWithZod } from "@conform-to/zod"

import {
  CSV_HOUSE_PLACEHOLDER_WEBSITE,
  CSV_HOUSE_DEFAULT_DESCRIPTION,
  CSV_PERFUME_DEFAULT_DESCRIPTION,
  HOUSE_PLACEHOLDER_IMAGE,
  MANUAL_COLLECTION_SOURCE,
  PERFUME_PLACEHOLDER_IMAGE,
} from "@/lib/csv-import-pending-submission"
import { prisma } from "@/lib/db"
import {
  createPendingPerfumeHousePlaceholder,
  getPerfumeHouseById,
  getPerfumeHouseByName,
} from "@/models/house.server"
import {
  createAdminAlertsForPendingSubmission,
  createPendingSubmission,
} from "@/models/pending-submission.server"
import { createPendingPerfumePlaceholder } from "@/models/perfume.server"
import { addUserPerfume } from "@/models/user.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"
import { CreateManualCollectionPerfumeSchema } from "@/utils/validation/formValidationSchemas"

const MANUAL_ENTRY_WINDOW_MS = 60 * 60 * 1000
const MANUAL_ENTRY_MAX_PER_HOUR = 20

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
    const formData = await request.formData()
    await requireCSRF(request, formData)

    const clientId = getClientIdentifierFromHeaders(request.headers)
    await validateRateLimit(
      `manual-catalog-entry:${user.id}:${clientId}`,
      MANUAL_ENTRY_MAX_PER_HOUR,
      MANUAL_ENTRY_WINDOW_MS
    )

    const submission = parseWithZod(formData, {
      schema: CreateManualCollectionPerfumeSchema,
    })

    if (submission.status !== "success") {
      return NextResponse.json(
        { success: false, error: "Invalid submission", issues: submission.error?.issues ?? [] },
        { status: 400 }
      )
    }

    const payload = submission.value
    const perfumeName = payload.perfumeName.trim()

    let resolvedHouseId = payload.existingHouseId?.trim() || ""
    let resolvedHouseName = ""
    let pendingHouseSubmissionId: string | undefined

    if (resolvedHouseId) {
      const existingHouse = await getPerfumeHouseById(resolvedHouseId)
      if (!existingHouse) {
        return NextResponse.json(
          { success: false, error: "Selected house was not found" },
          { status: 404 }
        )
      }
      if (existingHouse.isPending && existingHouse.submittedBy !== user.id) {
        return NextResponse.json(
          { success: false, error: "Selected house is not available" },
          { status: 400 }
        )
      }
      resolvedHouseName = existingHouse.name
    } else {
      const customHouseName = payload.customHouseName?.trim() || ""
      const existingByName = await getPerfumeHouseByName(customHouseName)
      if (existingByName) {
        resolvedHouseId = existingByName.id
        resolvedHouseName = existingByName.name
      } else {
        const placeholderHouse = await createPendingPerfumeHousePlaceholder({
          name: customHouseName,
          description: CSV_HOUSE_DEFAULT_DESCRIPTION,
          image: HOUSE_PLACEHOLDER_IMAGE,
          website: CSV_HOUSE_PLACEHOLDER_WEBSITE,
          submittedBy: user.id,
        })

        const houseSubmissionData = {
          source: MANUAL_COLLECTION_SOURCE,
          name: placeholderHouse.name,
          description: CSV_HOUSE_DEFAULT_DESCRIPTION,
          image: HOUSE_PLACEHOLDER_IMAGE,
          website: CSV_HOUSE_PLACEHOLDER_WEBSITE,
          type: "indie",
          placeholderHouseId: placeholderHouse.id,
        }
        const houseSubmission = await createPendingSubmission(
          "perfume_house",
          houseSubmissionData,
          user.id
        )
        pendingHouseSubmissionId = houseSubmission.id

        await prisma.perfumeHouse.update({
          where: { id: placeholderHouse.id },
          data: { pendingSubmissionId: houseSubmission.id },
        })
        await createAdminAlertsForPendingSubmission(
          houseSubmission.id,
          "perfume_house",
          houseSubmissionData
        )

        resolvedHouseId = placeholderHouse.id
        resolvedHouseName = placeholderHouse.name
      }
    }

    const existingPerfume = await prisma.perfume.findFirst({
      where: {
        name: { equals: perfumeName, mode: "insensitive" },
        perfumeHouseId: resolvedHouseId,
      },
      select: { id: true },
    })

    let perfumeIdToAdd: string
    if (existingPerfume) {
      perfumeIdToAdd = existingPerfume.id
    } else {
      const placeholderPerfume = await createPendingPerfumePlaceholder({
        name: perfumeName,
        description: CSV_PERFUME_DEFAULT_DESCRIPTION,
        image: PERFUME_PLACEHOLDER_IMAGE,
        houseId: resolvedHouseId,
        submittedBy: user.id,
      })

      const perfumeSubmissionData = {
        source: MANUAL_COLLECTION_SOURCE,
        name: placeholderPerfume.name,
        description: CSV_PERFUME_DEFAULT_DESCRIPTION,
        image: PERFUME_PLACEHOLDER_IMAGE,
        house: resolvedHouseId,
        houseName: resolvedHouseName,
        placeholderPerfumeId: placeholderPerfume.id,
        ...(pendingHouseSubmissionId
          ? { pendingHouseSubmissionId }
          : {}),
      }

      const perfumeSubmission = await createPendingSubmission(
        "perfume",
        perfumeSubmissionData,
        user.id
      )

      await prisma.perfume.update({
        where: { id: placeholderPerfume.id },
        data: { pendingSubmissionId: perfumeSubmission.id },
      })

      await createAdminAlertsForPendingSubmission(
        perfumeSubmission.id,
        "perfume",
        perfumeSubmissionData
      )
      perfumeIdToAdd = placeholderPerfume.id
    }

    const userPerfume = await addUserPerfume({
      userId: user.id,
      perfumeId: perfumeIdToAdd,
      amount: payload.amount,
      price: payload.price || undefined,
      placeOfPurchase: payload.placeOfPurchase || undefined,
      type: payload.type,
    })

    return NextResponse.json({
      success: true,
      userPerfume,
      message: "Added to your collection. Details pending admin review.",
    })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }
    if (error instanceof Response) {
      return error
    }
    console.error("[api/user-perfumes/manual-entry]", error)
    return NextResponse.json(
      { success: false, error: "Failed to create manual perfume entry" },
      { status: 500 }
    )
  }
}
