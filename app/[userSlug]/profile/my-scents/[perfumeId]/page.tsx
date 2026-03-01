import type { Metadata } from "next"
import type React from "react"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { getSingleUserPerfumeById } from "@/models/perfume.server"
import { getUserPerfumes } from "@/models/user.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getProfileSlug } from "@/utils/user"

import MySingleScentClient, { type SerializedUserPerfume } from "./MySingleScentClient"

type Props = {
  params: Promise<{ userSlug: string; perfumeId: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("myScents.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const getCookieHeader = async (): Promise<string> => {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
}

const serializeUserPerfume = (up: {
  id: string
  perfumeId: string
  userId: string
  comments?: Array<{ createdAt?: Date; updatedAt?: Date; [k: string]: unknown }>
  perfume: unknown
  [key: string]: unknown
}) => ({
  ...up,
  comments: (up.comments ?? []).map((c) => ({
    ...c,
    createdAt:
      c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt:
      c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  })),
})

export default async function MySingleScentPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { userSlug, perfumeId } = await params
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.userId || !session?.user) {
    redirect("/sign-in")
  }

  const slug = getProfileSlug(session.user)
  if (slug !== userSlug) {
    redirect(`/${slug}/profile/my-scents`)
  }

  const [userPerfume, allUserPerfumes] = await Promise.all([
    getSingleUserPerfumeById(perfumeId, session.userId),
    getUserPerfumes(session.userId),
  ])

  if (!userPerfume) {
    redirect(`/${slug}/profile/my-scents`)
  }

  const serializedUserPerfume = serializeUserPerfume(
    userPerfume as Parameters<typeof serializeUserPerfume>[0]
  )
  const serializedAll = allUserPerfumes.map((up) => ({
    ...up,
    createdAt:
      up.createdAt instanceof Date
        ? up.createdAt.toISOString()
        : (up.createdAt as string),
    available: up.available ?? null,
    price: up.price ?? null,
    placeOfPurchase: up.placeOfPurchase ?? null,
    tradePrice: up.tradePrice ?? null,
    tradePreference: up.tradePreference ?? null,
    tradeOnly: up.tradeOnly ?? null,
    type: up.type ?? null,
  }))

  return (
    <MySingleScentClient
      userPerfume={serializedUserPerfume as SerializedUserPerfume}
      allUserPerfumes={serializedAll}
      userSlug={slug}
    />
  )
}
