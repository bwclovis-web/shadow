import { prisma } from "@/lib/db"

export interface CreateContactMessageInput {
  senderId: string
  recipientId: string
  subject: string | null
  message: string
}

export interface ConversationSummary {
  otherUserId: string
  otherUserUsername: string | null
  otherUserFirstName: string | null
  otherUserLastName: string | null
  lastMessageAt: Date
  lastMessagePreview: string | null
  unreadCount: number
}

export async function createContactMessage(input: CreateContactMessageInput) {
  const { senderId, recipientId, subject, message } = input

  if (senderId === recipientId) {
    throw new Error("Cannot send message to yourself")
  }

  // Verify sender exists
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true },
  })

  if (!sender) {
    throw new Error("Sender not found")
  }

  // Verify recipient exists
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  })

  if (!recipient) {
    throw new Error("Recipient trader not found")
  }

  // Create the contact message
  return await prisma.traderContactMessage.create({
    data: {
      senderId,
      recipientId,
      subject,
      message,
    },
  })
}

/**
 * List conversations for a user: distinct other parties with last message and unread count.
 */
export async function getConversations(userId: string): Promise<ConversationSummary[]> {
  const sent = await prisma.traderContactMessage.findMany({
    where: { senderId: userId },
    select: {
      recipientId: true,
      createdAt: true,
      message: true,
      recipient: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const received = await prisma.traderContactMessage.findMany({
    where: { recipientId: userId },
    select: {
      senderId: true,
      createdAt: true,
      message: true,
      read: true,
      sender: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const byOther: Record<
    string,
    {
      otherUserId: string
      username: string | null
      firstName: string | null
      lastName: string | null
      lastMessageAt: Date
      lastMessagePreview: string | null
      unreadCount: number
    }
  > = {}

  for (const row of sent) {
    const id = row.recipientId
    if (!byOther[id] || row.createdAt > byOther[id].lastMessageAt) {
      byOther[id] = {
        otherUserId: id,
        username: row.recipient.username,
        firstName: row.recipient.firstName,
        lastName: row.recipient.lastName,
        lastMessageAt: row.createdAt,
        lastMessagePreview: row.message.slice(0, 80),
        unreadCount: 0,
      }
    }
  }

  for (const row of received) {
    const id = row.senderId
    const unread = (row.read === false ? 1 : 0) + (byOther[id]?.unreadCount ?? 0)
    if (!byOther[id] || row.createdAt > byOther[id].lastMessageAt) {
      byOther[id] = {
        otherUserId: id,
        username: row.sender.username,
        firstName: row.sender.firstName,
        lastName: row.sender.lastName,
        lastMessageAt: row.createdAt,
        lastMessagePreview: row.message.slice(0, 80),
        unreadCount: byOther[id]?.unreadCount ?? unread,
      }
    } else {
      byOther[id].unreadCount = unread
    }
  }

  // Fix unread: only count received messages that are unread
  const unreadByOther: Record<string, number> = {}
  for (const row of received) {
    if (!row.read) {
      unreadByOther[row.senderId] = (unreadByOther[row.senderId] ?? 0) + 1
    }
  }
  for (const id of Object.keys(byOther)) {
    byOther[id].unreadCount = unreadByOther[id] ?? 0
  }

  return Object.values(byOther)
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    .map((x) => ({
      otherUserId: x.otherUserId,
      otherUserUsername: x.username,
      otherUserFirstName: x.firstName,
      otherUserLastName: x.lastName,
      lastMessageAt: x.lastMessageAt,
      lastMessagePreview: x.lastMessagePreview,
      unreadCount: x.unreadCount,
    }))
}

/**
 * Get messages between the current user and another user, ordered by createdAt.
 */
export async function getThread(userId: string, otherUserId: string) {
  return prisma.traderContactMessage.findMany({
    where: {
      OR: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId },
      ],
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      recipient: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })
}

/**
 * Mark all messages in the thread where the current user is the recipient and the other user is the sender as read.
 */
export async function markThreadAsRead(userId: string, otherUserId: string) {
  await prisma.traderContactMessage.updateMany({
    where: {
      recipientId: userId,
      senderId: otherUserId,
      read: false,
    },
    data: { read: true },
  })
}
