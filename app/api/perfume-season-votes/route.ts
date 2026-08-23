import { NextRequest, NextResponse } from "next/server"

import {
  clearSeasonVote,
  getSeasonVoteAggregates,
  getUserSeasonVote,
  selectionFromVoteRow,
  upsertSeasonVote,
} from "@/models/perfumeSeasonVote.server"
import { hasAnySeasonSelected } from "@/types/perfume-season-vote"
import { parseFormData, parseQueryParams } from "@/utils/server/api-route-helpers.server"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"
import { validateRateLimit } from "@/utils/api-validation.server"
import { getUserMutationRateLimits } from "@/utils/rate-limit-config.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { getSessionFromRequest } from "@/utils/session-from-request.server"

export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const perfumeRaw = params.get("perfumeId")
    if (!perfumeRaw?.trim()) {
      return NextResponse.json({ error: "perfumeId is required" }, { status: 400 })
    }
    const perfumeId = perfumeRaw.trim()
    if (!isValidPrismaRecordId(perfumeId)) {
      return NextResponse.json({ error: "Invalid perfume ID" }, { status: 400 })
    }

    const aggregates = await getSeasonVoteAggregates(perfumeId)

    const session = await getSessionFromRequest(request, { includeUser: true })
    let userSelection: ReturnType<typeof selectionFromVoteRow> | null = null
    if (session?.userId) {
      const row = await getUserSeasonVote(session.userId, perfumeId)
      if (row) {
        userSelection = selectionFromVoteRow(row)
      }
    }

    return NextResponse.json({ aggregates, userSelection })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch season votes"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const formData = await parseFormData(request)
    await requireCSRF(request, formData)

    const mutationLimits = getUserMutationRateLimits()
    try {
      await validateRateLimit(
        `season-votes:post:${authResult.user!.id}`,
        mutationLimits.seasonVotesPost.max,
        mutationLimits.seasonVotesPost.windowMs
      )
    } catch (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) {
        return rateLimitResponse
      }
      throw rateLimitResponse
    }

    const perfumeId = formData.required("perfumeId").trim()
    if (!isValidPrismaRecordId(perfumeId)) {
      return NextResponse.json({ error: "Invalid perfume ID" }, { status: 400 })
    }

    const selection = {
      winter: formData.getBoolean("winter"),
      spring: formData.getBoolean("spring"),
      summer: formData.getBoolean("summer"),
      fall: formData.getBoolean("fall"),
    }

    if (!hasAnySeasonSelected(selection)) {
      await clearSeasonVote(authResult.user!.id, perfumeId)
      return NextResponse.json({ message: "Season vote cleared successfully" })
    }

    await upsertSeasonVote(authResult.user!.id, perfumeId, selection)
    return NextResponse.json({ message: "Season vote saved successfully" })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : "Failed to save season vote"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
