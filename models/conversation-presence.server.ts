import { prisma } from "@/lib/db"

const PRESENCE_ACTIVE_MS = 2 * 60 * 1000

export const updateConversationPresence = async (
  userId: string,
  counterpartUserId: string | null
) =>
  prisma.userConversationPresence.upsert({
    where: { userId },
    update: {
      counterpartUserId,
      updatedAt: new Date(),
    },
    create: {
      userId,
      counterpartUserId,
    },
  })

export const isUserActiveInConversation = async (
  userId: string,
  counterpartUserId: string
): Promise<boolean> => {
  const presence = await prisma.userConversationPresence.findUnique({
    where: { userId },
  })
  if (!presence?.counterpartUserId || presence.counterpartUserId !== counterpartUserId) {
    return false
  }
  return Date.now() - presence.updatedAt.getTime() < PRESENCE_ACTIVE_MS
}
