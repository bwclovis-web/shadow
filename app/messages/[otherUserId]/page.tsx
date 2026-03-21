import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { notFound, redirect } from "next/navigation"

import { getThread, markThreadAsRead } from "@/models/contactMessage.server"
import { prisma } from "@/lib/db"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getTraderDisplayName } from "@/utils/user"

import ThreadClient from "./ThreadClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ otherUserId: string }>
}): Promise<Metadata> {
  const { otherUserId } = await params
  const t = await getTranslations("directMessages.meta")
  const otherUser = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { username: true, firstName: true, lastName: true },
  })
  if (!otherUser) {
    return {
      title: t("threadFallbackTitle"),
      description: t("description"),
    }
  }
  const name = getTraderDisplayName(otherUser)
  return {
    title: t("threadTitle", { name }),
    description: t("threadDescription", { name }),
  }
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ otherUserId: string }>
}): Promise<React.ReactElement> {
  const { otherUserId } = await params
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  if (otherUserId === session.user.id) {
    notFound()
  }

  const otherUser = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { id: true, username: true, firstName: true, lastName: true },
  })
  if (!otherUser) notFound()

  let thread: Awaited<ReturnType<typeof getThread>> = []
  try {
    thread = await getThread(session.user.id, otherUserId)
    await markThreadAsRead(session.user.id, otherUserId)
  } catch (error) {
    console.error("Failed to load thread:", error)
  }

  return (
    <ThreadClient
      currentUserId={session.user.id}
      otherUser={otherUser}
      initialThread={thread}
    />
  )
}
