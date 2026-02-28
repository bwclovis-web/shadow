import type { Metadata } from "next"
import type React from "react"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { getUserPerfumes } from "@/models/user.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getProfileSlug } from "@/utils/user"

import MyScentsPageClient from "./MyScentsPageClient"

const BANNER_IMAGE = "/images/perfume.webp"

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
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

export default async function MyScentsPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { userSlug } = await params
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const slug = getProfileSlug(session.user)
  if (slug !== userSlug) {
    redirect(`/${slug}/profile/my-scents`)
  }

  const userPerfumes = await getUserPerfumes(session.user.id)

  const serialized = userPerfumes.map((up) => ({
    ...up,
    createdAt: up.createdAt.toISOString(),
    available: up.available ?? null,
    price: up.price ?? null,
    placeOfPurchase: up.placeOfPurchase ?? null,
    tradePrice: up.tradePrice ?? null,
    tradePreference: up.tradePreference ?? null,
    tradeOnly: up.tradeOnly ?? null,
    type: up.type ?? null,
  }))

  return (
    <MyScentsPageClient
      userPerfumes={serialized}
      bannerImage={BANNER_IMAGE}
    />
  )
}
