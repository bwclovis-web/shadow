import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { getSingleUserPerfumeById } from "@/models/perfume.server"
import { getUserPerfumes } from "@/models/user.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

import MySingleScentClient, { type SerializedUserPerfume } from "./MySingleScentClient"

type Props = {
  params: Promise<{ userSlug: string; perfumeId: string }>
  searchParams: Promise<{ list?: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("myScents.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const serializeUserPerfume = (up: {
  id: string
  perfumeId: string
  userId: string
  amount?: string | null
  available?: string | null
  type?: string | null
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
  searchParams,
}: Props): Promise<React.ReactElement> {
  const { userSlug, perfumeId } = await params
  const { list } = await searchParams
  const openListingFlow = list === "1"
  const { user } = await requireOwnedProfileSession(userSlug, { subPath: "my-scents" })

  const [userPerfume, allUserPerfumes] = await Promise.all([
    getSingleUserPerfumeById(perfumeId, user.id),
    getUserPerfumes(user.id),
  ])

  if (!userPerfume) {
    redirect(`/${userSlug}/profile/my-scents`)
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
      userSlug={userSlug}
      openListingFlow={openListingFlow}
    />
  )
}
