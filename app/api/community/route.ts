import { NextRequest, NextResponse } from "next/server"

import {
  addPerfumeToList,
  addPerfumeToShelf,
  createCollectionShelf,
  createUserList,
  createWearJournalEntry,
  deleteCollectionShelf,
  deleteWearJournalEntry,
  getPublicShelfById,
  joinCommunityChallenge,
  listCollectionShelves,
  listPublicShelves,
  listPublishedChallenges,
  listWearJournal,
  updateWearJournalEntry,
} from "@/models/community.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"
import { isFeatureEnabled } from "@/utils/feature-flags"

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const kind = searchParams.get("kind") ?? "shelves"

  if (kind === "challenges") {
    const challenges = await listPublishedChallenges()
    return NextResponse.json({ success: true, challenges })
  }

  if (kind === "public-shelves") {
    if (!isFeatureEnabled("communityShelves")) {
      return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
    }
    const shelves = await listPublicShelves()
    return NextResponse.json({ success: true, shelves })
  }

  if (kind === "shelf") {
    if (!isFeatureEnabled("communityShelves")) {
      return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
    }
    const id = searchParams.get("id") ?? ""
    if (!isValidPrismaRecordId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }
    const shelf = await getPublicShelfById(id)
    if (!shelf) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, shelf })
  }

  const auth = await authenticateUser(request)
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
  }

  if (!isFeatureEnabled("communityShelves") && kind === "shelves") {
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
  }

  if (kind === "journal") {
    const entries = await listWearJournal(auth.user!.id)
    return NextResponse.json({ success: true, entries })
  }
  const shelves = await listCollectionShelves(auth.user!.id, auth.user!.id)
  return NextResponse.json({ success: true, shelves })
}

export const POST = async (request: NextRequest) => {
  try {
    const auth = await authenticateUser(request)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
    }
    const body = await request.json()
    await requireCSRFForJsonBody(request, body)
    const intent = body?.intent as string

    const shelfIntents = new Set([
      "create-shelf",
      "add-to-shelf",
      "delete-shelf",
      "create-list",
      "add-to-list",
    ])
    if (shelfIntents.has(intent) && !isFeatureEnabled("communityShelves")) {
      return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
    }

    if (intent === "create-shelf") {
      const name = typeof body?.name === "string" ? body.name.trim() : ""
      if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })
      const challengeId =
        typeof body?.challengeId === "string" && isValidPrismaRecordId(body.challengeId)
          ? body.challengeId
          : null
      const shelf = await createCollectionShelf({
        userId: auth.user!.id,
        name,
        description: typeof body?.description === "string" ? body.description : null,
        isPublic: Boolean(body?.isPublic),
        challengeId,
      })
      return NextResponse.json({ success: true, shelf })
    }

    if (intent === "add-to-shelf") {
      const shelfId = typeof body?.shelfId === "string" ? body.shelfId : ""
      const perfumeId = typeof body?.perfumeId === "string" ? body.perfumeId : ""
      if (!isValidPrismaRecordId(shelfId) || !isValidPrismaRecordId(perfumeId)) {
        return NextResponse.json({ error: "Invalid ids" }, { status: 400 })
      }
      const item = await addPerfumeToShelf({
        userId: auth.user!.id,
        shelfId,
        perfumeId,
        note: typeof body?.note === "string" ? body.note : null,
      })
      return NextResponse.json({ success: true, item })
    }

    if (intent === "delete-shelf") {
      const shelfId = typeof body?.shelfId === "string" ? body.shelfId : ""
      if (!isValidPrismaRecordId(shelfId)) {
        return NextResponse.json({ error: "Invalid shelfId" }, { status: 400 })
      }
      try {
        const deleted = await deleteCollectionShelf({
          userId: auth.user!.id,
          shelfId,
        })
        return NextResponse.json({ success: true, deleted })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed"
        if (msg === "Shelf not found") {
          return NextResponse.json({ error: msg }, { status: 404 })
        }
        throw err
      }
    }

    if (intent === "create-list") {
      const name = typeof body?.name === "string" ? body.name.trim() : ""
      if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })
      const list = await createUserList({
        userId: auth.user!.id,
        name,
        description: typeof body?.description === "string" ? body.description : null,
        isPublic: body?.isPublic !== false,
      })
      return NextResponse.json({ success: true, list })
    }

    if (intent === "add-to-list") {
      const listId = typeof body?.listId === "string" ? body.listId : ""
      const perfumeId = typeof body?.perfumeId === "string" ? body.perfumeId : ""
      if (!isValidPrismaRecordId(listId) || !isValidPrismaRecordId(perfumeId)) {
        return NextResponse.json({ error: "Invalid ids" }, { status: 400 })
      }
      const item = await addPerfumeToList({
        userId: auth.user!.id,
        listId,
        perfumeId,
        note: typeof body?.note === "string" ? body.note : null,
      })
      return NextResponse.json({ success: true, item })
    }

    if (intent === "wear-journal") {
      const perfumeId = typeof body?.perfumeId === "string" ? body.perfumeId : ""
      if (!isValidPrismaRecordId(perfumeId)) {
        return NextResponse.json({ error: "Invalid perfumeId" }, { status: 400 })
      }
      const oilPerfumeIdRaw =
        typeof body?.oilPerfumeId === "string" ? body.oilPerfumeId : ""
      const oilPerfumeId = oilPerfumeIdRaw
        ? isValidPrismaRecordId(oilPerfumeIdRaw)
          ? oilPerfumeIdRaw
          : null
        : null
      if (oilPerfumeIdRaw && !oilPerfumeId) {
        return NextResponse.json({ error: "Invalid oilPerfumeId" }, { status: 400 })
      }
      const wornOn = body?.wornOn ? new Date(body.wornOn) : new Date()
      const entry = await createWearJournalEntry({
        userId: auth.user!.id,
        perfumeId,
        oilPerfumeId,
        wornOn,
        season: typeof body?.season === "string" ? body.season : null,
        rating: typeof body?.rating === "number" ? body.rating : null,
        notes: typeof body?.notes === "string" ? body.notes : null,
        weather: typeof body?.weather === "string" ? body.weather : null,
        occasion: typeof body?.occasion === "string" ? body.occasion : null,
      })
      return NextResponse.json({ success: true, entry })
    }

    if (intent === "update-wear-journal") {
      const entryId = typeof body?.entryId === "string" ? body.entryId : ""
      if (!isValidPrismaRecordId(entryId)) {
        return NextResponse.json({ error: "Invalid entryId" }, { status: 400 })
      }
      try {
        const entry = await updateWearJournalEntry({
          userId: auth.user!.id,
          entryId,
          perfumeId:
            typeof body?.perfumeId === "string" && isValidPrismaRecordId(body.perfumeId)
              ? body.perfumeId
              : undefined,
          oilPerfumeId:
            body?.oilPerfumeId === null
              ? null
              : typeof body?.oilPerfumeId === "string" &&
                  isValidPrismaRecordId(body.oilPerfumeId)
                ? body.oilPerfumeId
                : undefined,
          wornOn: body?.wornOn ? new Date(body.wornOn) : undefined,
          season: typeof body?.season === "string" ? body.season : body?.season === null ? null : undefined,
          rating: typeof body?.rating === "number" ? body.rating : body?.rating === null ? null : undefined,
          notes: typeof body?.notes === "string" ? body.notes : body?.notes === null ? null : undefined,
          weather: typeof body?.weather === "string" ? body.weather : body?.weather === null ? null : undefined,
          occasion: typeof body?.occasion === "string" ? body.occasion : body?.occasion === null ? null : undefined,
        })
        return NextResponse.json({ success: true, entry })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed"
        if (msg === "Entry not found") {
          return NextResponse.json({ error: msg }, { status: 404 })
        }
        throw err
      }
    }

    if (intent === "delete-wear-journal") {
      const entryId = typeof body?.entryId === "string" ? body.entryId : ""
      if (!isValidPrismaRecordId(entryId)) {
        return NextResponse.json({ error: "Invalid entryId" }, { status: 400 })
      }
      try {
        const deleted = await deleteWearJournalEntry({
          userId: auth.user!.id,
          entryId,
        })
        return NextResponse.json({ success: true, deleted })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed"
        if (msg === "Entry not found") {
          return NextResponse.json({ error: msg }, { status: 404 })
        }
        throw err
      }
    }

    if (intent === "join-challenge") {
      const challengeId = typeof body?.challengeId === "string" ? body.challengeId : ""
      if (!isValidPrismaRecordId(challengeId)) {
        return NextResponse.json({ error: "Invalid challengeId" }, { status: 400 })
      }
      const entry = await joinCommunityChallenge({
        userId: auth.user!.id,
        challengeId,
        perfumeId:
          typeof body?.perfumeId === "string" && isValidPrismaRecordId(body.perfumeId)
            ? body.perfumeId
            : null,
        caption: typeof body?.caption === "string" ? body.caption : null,
      })
      return NextResponse.json({ success: true, entry })
    }

    return NextResponse.json({ error: "Unknown intent" }, { status: 400 })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Response) return error
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
