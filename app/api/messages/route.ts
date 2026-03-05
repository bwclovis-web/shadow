import { NextRequest, NextResponse } from "next/server"

import {
  getConversations,
  getThread,
  markThreadAsRead,
} from "@/models/contactMessage.server"
import { authenticateUser } from "@/utils/server/auth.server"

export async function GET(request: NextRequest) {
  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status ?? 401 }
    )
  }

  const userId = authResult.user!.id
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
