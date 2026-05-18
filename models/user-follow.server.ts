import { prisma } from "@/lib/db"

export type FollowTargetType = "user" | "house" | "perfume"

export type FollowedIds = {
  userIds: string[]
  houseIds: string[]
  perfumeIds: string[]
  houseSlugs: string[]
  perfumeSlugs: string[]
}

const targetField = (targetType: FollowTargetType) => {
  switch (targetType) {
    case "user":
      return "followingUserId" as const
    case "house":
      return "followingHouseId" as const
    case "perfume":
      return "followingPerfumeId" as const
  }
}

export const getFollowerCountForUser = async (userId: string): Promise<number> =>
  prisma.userFollow.count({
    where: { followingUserId: userId },
  })

export const isFollowing = async (
  followerId: string,
  targetType: FollowTargetType,
  targetId: string
): Promise<boolean> => {
  const field = targetField(targetType)
  const row = await prisma.userFollow.findFirst({
    where: { followerId, [field]: targetId },
    select: { id: true },
  })
  return row !== null
}

export const getFollowStateForViewer = async (
  viewerId: string | null,
  targetType: FollowTargetType,
  targetId: string
): Promise<{ following: boolean; followerCount?: number }> => {
  if (targetType === "user") {
    const followerCount = await getFollowerCountForUser(targetId)
    if (!viewerId) {
      return { following: false, followerCount }
    }
    const following = await isFollowing(viewerId, "user", targetId)
    return { following, followerCount }
  }
  if (!viewerId) {
    return { following: false }
  }
  const following = await isFollowing(viewerId, targetType, targetId)
  return { following }
}

export const getFollowedIdsForViewer = async (viewerId: string): Promise<FollowedIds> => {
  const rows = await prisma.userFollow.findMany({
    where: { followerId: viewerId },
    select: {
      followingUserId: true,
      followingHouseId: true,
      followingPerfumeId: true,
      followingHouse: { select: { slug: true } },
      followingPerfume: { select: { slug: true } },
    },
  })

  const userIds: string[] = []
  const houseIds: string[] = []
  const perfumeIds: string[] = []
  const houseSlugs: string[] = []
  const perfumeSlugs: string[] = []

  for (const row of rows) {
    if (row.followingUserId) userIds.push(row.followingUserId)
    if (row.followingHouseId) {
      houseIds.push(row.followingHouseId)
      if (row.followingHouse?.slug) houseSlugs.push(row.followingHouse.slug)
    }
    if (row.followingPerfumeId) {
      perfumeIds.push(row.followingPerfumeId)
      if (row.followingPerfume?.slug) perfumeSlugs.push(row.followingPerfume.slug)
    }
  }

  return { userIds, houseIds, perfumeIds, houseSlugs, perfumeSlugs }
}

export const getFollowersOfUser = async (userId: string): Promise<string[]> => {
  const rows = await prisma.userFollow.findMany({
    where: { followingUserId: userId },
    select: { followerId: true },
  })
  return rows.map(r => r.followerId)
}

export const getFollowersForHouse = async (houseId: string): Promise<string[]> => {
  const rows = await prisma.userFollow.findMany({
    where: { followingHouseId: houseId },
    select: { followerId: true },
  })
  return rows.map(r => r.followerId)
}

export const getFollowersForPerfume = async (perfumeId: string): Promise<string[]> => {
  const rows = await prisma.userFollow.findMany({
    where: { followingPerfumeId: perfumeId },
    select: { followerId: true },
  })
  return rows.map(r => r.followerId)
}

const assertTargetExists = async (
  targetType: FollowTargetType,
  targetId: string
): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (targetType === "user") {
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, isBanned: true },
    })
    if (!user) return { ok: false, error: "User not found" }
    if (user.isBanned) return { ok: false, error: "Cannot follow this user" }
    return { ok: true }
  }
  if (targetType === "house") {
    const house = await prisma.perfumeHouse.findUnique({
      where: { id: targetId },
      select: { id: true },
    })
    if (!house) return { ok: false, error: "House not found" }
    return { ok: true }
  }
  const perfume = await prisma.perfume.findUnique({
    where: { id: targetId },
    select: { id: true },
  })
  if (!perfume) return { ok: false, error: "Perfume not found" }
  return { ok: true }
}

export const follow = async (
  followerId: string,
  targetType: FollowTargetType,
  targetId: string
): Promise<{ success: true; following: true } | { success: false; error: string }> => {
  if (targetType === "user" && followerId === targetId) {
    return { success: false, error: "Cannot follow yourself" }
  }

  const targetCheck = await assertTargetExists(targetType, targetId)
  if (!targetCheck.ok) return { success: false, error: targetCheck.error }

  const field = targetField(targetType)
  const existing = await prisma.userFollow.findFirst({
    where: { followerId, [field]: targetId },
    select: { id: true },
  })
  if (!existing) {
    await prisma.userFollow.create({
      data: { followerId, [field]: targetId },
    })
  }

  return { success: true, following: true }
}

export const unfollow = async (
  followerId: string,
  targetType: FollowTargetType,
  targetId: string
): Promise<{ success: true; following: false }> => {
  const field = targetField(targetType)
  await prisma.userFollow.deleteMany({
    where: { followerId, [field]: targetId },
  })
  return { success: true, following: false }
}
