import type React from "react"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { redirect } from "next/navigation"

import { getConversations } from "@/models/contactMessage.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import MessagesClient from "./MessagesClient"

export default async function MessagesPage(): Promise<React.ReactElement> {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  let conversations: Awaited<ReturnType<typeof getConversations>> = []
  try {
    conversations = await getConversations(session.user.id)
  } catch (error) {
    console.error("Failed to load conversations:", error)
  }

  return (
    <MessagesClient
      userId={session.user.id}
      initialConversations={conversations}
    />
  )
}
