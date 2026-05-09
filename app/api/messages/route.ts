import { NextRequest, NextResponse } from "next/server"

import {
  deleteConversationBetweenUsers,
  getConversations,
  getThread,
  getUnreadDirectMessageCount,
  markThreadAsRead,
} from "@/models/contactMessage.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"

export async function GET(request: NextRequest) {
  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status ?? 401 }
    )
  }

  const userId = authResult.user!.id
  const unreadCountOnly =
    request.nextUrl.searchParams.get("unreadCountOnly") === "1"

  if (unreadCountOnly) {
    try {
      const unreadCount = await getUnreadDirectMessageCount(userId)
      return NextResponse.json({ unreadCount })
    } catch (error) {
      console.error("Failed to load unread message count:", error)
      return NextResponse.json(
        { error: "Failed to load unread count" },
        { status: 500 }
      )
    }
  }

  const otherUserId = request.nextUrl.searchParams.get("otherUserId")

  if (otherUserId) {
    if (otherUserId === userId) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 })
    }
    try {
      const thread = await getThread(userId, otherUserId)
      await markThreadAsRead(userId, otherUserId)
      return NextResponse.json({ thread })
    } catch (error) {
      console.error("Failed to fetch thread:", error)
      return NextResponse.json(
        { error: "Failed to load conversation" },
        { status: 500 }
      )
    }
  }

  try {
    const conversations = await getConversations(userId)
    return NextResponse.json({ conversations })
  } catch (error) {
    console.error("Failed to fetch conversations:", error)
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireCSRF(request)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status ?? 401 }
    )
  }

  const userId = authResult.user!.id
  const otherUserId = request.nextUrl.searchParams.get("otherUserId")

  if (!otherUserId?.trim() || otherUserId === userId) {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 })
  }

  try {
    await deleteConversationBetweenUsers(userId, otherUserId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete conversation:", error)
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    )
  }
}
