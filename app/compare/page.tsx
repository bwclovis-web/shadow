import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import ComparePageClient from "./ComparePageClient"
import {
  compareIdsExceedMax,
  getComparePayload,
  normalizeCompareIds,
} from "@/models/compare.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"

type ComparePageProps = {
  searchParams: Promise<{ ids?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("compare.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const userId = session?.user?.id ?? null

  const { ids: idsParam } = await searchParams
  const initialUrlIds = idsParam
    ? normalizeCompareIds(idsParam.split(","))
    : []
  const initialCompareData =
    initialUrlIds.length > 0 && !compareIdsExceedMax(initialUrlIds)
      ? await getComparePayload(initialUrlIds)
      : undefined

  return (
    <ComparePageClient
      userId={userId}
      initialUrlIds={initialUrlIds}
      initialCompareData={initialCompareData}
    />
  )
}
