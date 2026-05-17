import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { getCachedDisplayableNotesForQuiz } from "@/models/tags.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import {
  parseStep,
  Q,
  VALID_SEASONS,
  type SeasonId,
} from "./constants"
import ScentQuizClient from "./ScentQuizClient"

export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("quiz.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

function splitCsv(param: string | string[] | undefined): string[] {
  if (param === undefined) return []
  const raw = Array.isArray(param) ? param[0] : param
  return raw?.split(",").filter(Boolean) ?? []
}

export default async function ScentQuizPage({
  searchParams,
}: Props): Promise<React.ReactElement> {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const sp = await searchParams
  const rawStep = sp[Q.step]
  const stepParam =
    typeof rawStep === "string"
      ? rawStep
      : Array.isArray(rawStep)
        ? (rawStep[0] ?? null)
        : null
  const step = parseStep(stepParam)

  const initialNoteIds = splitCsv(sp[Q.noteIds])
  const initialAvoidNoteIds = splitCsv(sp[Q.avoidNoteIds])
  const seasonRaw = splitCsv(sp[Q.season])
  const initialSeasonIds = seasonRaw.filter((s) =>
    VALID_SEASONS.includes(s as SeasonId)
  )
  const readParam = (key: string): string => {
    const raw = sp[key]
    if (typeof raw === "string") return raw
    if (Array.isArray(raw)) return raw[0] ?? ""
    return ""
  }

  const notes = await getCachedDisplayableNotesForQuiz()

  return (
    <ScentQuizClient
      notes={notes}
      step={step}
      initialNoteIds={initialNoteIds}
      initialAvoidNoteIds={initialAvoidNoteIds}
      initialSeasonIds={initialSeasonIds}
      initialBudget={readParam(Q.budget)}
      initialConcentration={readParam(Q.concentration)}
      initialHouseTier={readParam(Q.houseTier)}
      initialBrowsingStyle={readParam(Q.browsingStyle)}
    />
  )
}
