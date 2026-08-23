import { prisma } from "@/lib/db"

export const areUsersBlocked = async (
  userAId: string,
  userBId: string
): Promise<boolean> => {
  if (!userAId || !userBId || userAId === userBId) return false
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId },
      ],
    },
    select: { id: true },
  })
  return Boolean(row)
}

export const blockUser = async (blockerId: string, blockedId: string) => {
  if (blockerId === blockedId) {
    throw new Error("Cannot block yourself")
  }
  return prisma.userBlock.upsert({
    where: {
      blockerId_blockedId: { blockerId, blockedId },
    },
    create: { blockerId, blockedId },
    update: {},
  })
}

export const unblockUser = async (blockerId: string, blockedId: string) => {
  return prisma.userBlock.deleteMany({
    where: { blockerId, blockedId },
  })
}

export const isBlockedByViewer = async (
  viewerId: string,
  otherUserId: string
): Promise<boolean> => {
  const row = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: { blockerId: viewerId, blockedId: otherUserId },
    },
    select: { id: true },
  })
  return Boolean(row)
}
