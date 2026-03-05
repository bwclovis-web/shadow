import type React from "react"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { getThread, markThreadAsRead } from "@/models/contactMessage.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { prisma } from "@/lib/db"

import ThreadClient from "./ThreadClient"

async function getCookieHeader(): Promise<string> {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
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
