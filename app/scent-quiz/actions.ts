"use server"

import { getTranslations } from "next-intl/server"

import { syncOnboardingCompletion } from "@/models/onboarding.server"
import {
  updateScentProfileFromQuiz,
  type ScentQuizData,
} from "@/models/scent-profile.server"
import { getCachedMaterialsForQuiz } from "@/models/tags.server"
import {
  budgetTierToPriceRange,
  parseQuizBudgetTier,
  parseQuizConcentrationPreference,
  parseQuizHouseTierPreference,
} from "@/utils/scent-profile-preferences"
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
  | { success: true; userId: string }
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

  const allowedMaterialIds = new Set(
    (await getCachedMaterialsForQuiz()).map((m) => m.id)
  )

  const materialIds = formData
    .getAll("noteIds")
    .filter((v): v is string => typeof v === "string" && allowedMaterialIds.has(v))
  const materialAvoidIds = formData
    .getAll("avoidNoteIds")
    .filter((v): v is string => typeof v === "string" && allowedMaterialIds.has(v))
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

  const formString = (key: string): string | null => {
    const value = formData.get(key)
    return typeof value === "string" ? value : null
  }

  const budgetTier = parseQuizBudgetTier(formString("budget"))
  const concentrationPref = parseQuizConcentrationPreference(formString("concentration"))
  const houseTierPref = parseQuizHouseTierPreference(formString("houseTier"))

  const tErr = await getTranslations("quiz.errors")

  if (materialIds.length < MIN_NOTE_SELECTIONS) {
    return {
      error: tErr("minNotes", { min: MIN_NOTE_SELECTIONS }),
    }
  }
  if (materialIds.length > MAX_NOTE_SELECTIONS) {
    return {
      error: tErr("maxNotes", { max: MAX_NOTE_SELECTIONS }),
    }
  }

  const materialWeights: Record<string, number> = {}
  for (const id of materialIds) {
    materialWeights[id] = 1
  }

  const priceRangeFromBudget = budgetTier ? budgetTierToPriceRange(budgetTier) : null
  const preferredPriceRange =
    priceRangeFromBudget == null
      ? null
      : {
          ...(priceRangeFromBudget.min != null ? { min: priceRangeFromBudget.min } : {}),
          ...(priceRangeFromBudget.max != null ? { max: priceRangeFromBudget.max } : {}),
        }

  const quizData: ScentQuizData = {
    materialWeights,
    materialAvoidIds,
    seasonHints,
    browsingStyle,
    preferredPriceRange: budgetTier != null ? preferredPriceRange : null,
    preferredConcentration: concentrationPref ?? null,
    preferredHouseTier: houseTierPref ?? null,
  }

  await updateScentProfileFromQuiz(session.user.id, quizData)
  await syncOnboardingCompletion(session.user.id)

  const { recordTasteEvent } = await import("@/models/taste-event.server")
  await recordTasteEvent({
    userId: session.user.id,
    eventType: "quiz_answer",
    metadata: {
      materialCount: materialIds.length,
      avoidCount: materialAvoidIds.length,
      seasons: seasonHints,
    },
  })

  return { success: true, userId: session.user.id }
}
