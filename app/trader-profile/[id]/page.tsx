import type { Metadata } from "next"
import type React from "react"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import type { TraderResponse } from "@/lib/queries/user"
import type { TraderFeedbackResponse } from "@/lib/queries/traderFeedback"
import { getTraderFeedbackForProfile } from "@/models/traderFeedback.server"
import { getTraderById } from "@/models/user.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import TraderProfileClient from "./TraderProfileClient"

type Props = {
  params: Promise<{ id: string }>
}

async function getCookieHeader(): Promise<string> {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { id } = await params
  const trader = await getTraderById(id)
  if (!trader) return { title: "Trader" }
  const t = await getTranslations("traderProfile.meta")
  const traderName =
    [trader.firstName, trader.lastName].filter(Boolean).join(" ").trim() ||
    trader.email ||
    "Trader"
  return {
    title: t("title"),
    description: t("description", { traderName }),
  }
}

export default async function TraderProfilePage({
  params,
}: Props): Promise<React.ReactElement> {
  const { id } = await params
  if (!id) notFound()

  const trader = await getTraderById(id)
  if (!trader) notFound()

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const viewer = session?.user ?? null
  const viewerId = viewer?.id ?? null

  const feedback: TraderFeedbackResponse = await getTraderFeedbackForProfile(
    trader.id,
    viewerId
  )

  return (
    <TraderProfileClient
      initialTrader={trader as TraderResponse}
      viewer={viewer}
      feedback={feedback}
    />
  )
}
