"use server"

import { getTranslations } from "next-intl/server"

import {
  updateScentProfileFromQuiz,
  type ScentQuizData,
} from "@/models/scent-profile.server"
import {
  getCachedDisplayableNotesForQuiz,
} from "@/models/tags.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import {
  MAX_NOTE_SELECTIONS,
  MIN_NOTE_SELECTIONS,
  VALID_SEASONS,
  type SeasonId,
} from "./constants"

export type ScentQuizActionState =
  | { success: true }
  | { success?: false; error: string }
  | null

export const submitScentQuizAction = async (
  _prevState: ScentQuizActionState,
  formData: FormData
): Promise<ScentQuizActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  if (!session?.user) {
    const t = await getTranslations("quiz.errors")
    return { error: t("mustSignIn") }
  }

  const allowedIds = new Set(
    (await getCachedDisplayableNotesForQuiz()).map((n) => n.id)
  )

  const noteIds = formData
    .getAll("noteIds")
    .filter((v): v is string => typeof v === "string" && allowedIds.has(v))
  const avoidNoteIds = formData
    .getAll("avoidNoteIds")
    .filter((v): v is string => typeof v === "string" && allowedIds.has(v))
  const seasonIdsRaw = formData
    .getAll("season")
    .filter((v): v is string => typeof v === "string")
  const seasonHints = seasonIdsRaw.filter((s) =>
    VALID_SEASONS.includes(s as SeasonId)
  ) as SeasonId[]
  const browsingRaw = formData.get("browsingStyle")
  const browsingStyle =
    browsingRaw === "explorer" || browsingRaw === "focused" || browsingRaw === "trader"
      ? browsingRaw
      : null

  const tErr = await getTranslations("quiz.errors")

  if (noteIds.length < MIN_NOTE_SELECTIONS) {
    return {
      error: tErr("minNotes", { min: MIN_NOTE_SELECTIONS }),
    }
  }
  if (noteIds.length > MAX_NOTE_SELECTIONS) {
    return {
      error: tErr("maxNotes", { max: MAX_NOTE_SELECTIONS }),
    }
  }

  const noteWeights: Record<string, number> = {}
  for (const id of noteIds) {
    noteWeights[id] = 1
  }

  const quizData: ScentQuizData = {
    noteWeights,
    avoidNoteIds: avoidNoteIds.length > 0 ? avoidNoteIds : undefined,
    seasonHints: seasonHints.length > 0 ? seasonHints : undefined,
    browsingStyle,
  }

  await updateScentProfileFromQuiz(session.user.id, quizData)

  return { success: true }
}
