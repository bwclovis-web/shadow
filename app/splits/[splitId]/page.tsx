import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { getDecantSplitById } from "@/models/decant-split.server"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { isDecantSplitsEnabled } from "@/utils/decant-splits-enabled.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import DecantSplitClient from "./DecantSplitClient"

type PageProps = {
  params: Promise<{ splitId: string }>
}

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const { splitId } = await params
  const t = await getTranslations("decantSplits.meta")
  const split = await getDecantSplitById(splitId)
  if (!split) {
    return buildPageMetadata({
      title: t("notFoundTitle"),
      description: t("notFoundDescription"),
      canonicalPath: `/splits/${splitId}`,
    })
  }
  return buildPageMetadata({
    title: t("title", { perfume: split.perfumeName }),
    description: t("description", { perfume: split.perfumeName }),
    canonicalPath: `/splits/${splitId}`,
  })
}

const DecantSplitPage = async ({ params }: PageProps) => {
  if (!isDecantSplitsEnabled()) {
    notFound()
  }

  const { splitId } = await params
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, { includeUser: true })
  const viewerId = session?.user?.id ?? null

  const split = await getDecantSplitById(splitId, viewerId)
  if (!split) {
    notFound()
  }

  return <DecantSplitClient initialSplit={split} viewerId={viewerId} />
}

export default DecantSplitPage
