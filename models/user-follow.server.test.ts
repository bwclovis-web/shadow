import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    userFollow: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    perfumeHouse: {
      findUnique: vi.fn(),
    },
    perfume: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}))

import {
  follow,
  getFollowedIdsForViewer,
  getFollowerCountForUser,
  unfollow,
} from "./user-follow.server"

describe("user-follow.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getFollowerCountForUser counts follows", async () => {
    prismaMock.userFollow.count.mockResolvedValue(3)
    await expect(getFollowerCountForUser("trader-1")).resolves.toBe(3)
    expect(prismaMock.userFollow.count).toHaveBeenCalledWith({
      where: { followingUserId: "trader-1" },
    })
  })

  it("follow blocks self-follow", async () => {
    const result = await follow("u1", "user", "u1")
    expect(result).toEqual({ success: false, error: "Cannot follow yourself" })
  })

  it("follow creates row when target exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "t1", isBanned: false })
    prismaMock.userFollow.findFirst.mockResolvedValue(null)
    prismaMock.userFollow.create.mockResolvedValue({ id: "f1" })

    const result = await follow("u1", "user", "t1")
    expect(result).toEqual({ success: true, following: true })
    expect(prismaMock.userFollow.create).toHaveBeenCalled()
  })

  it("unfollow removes row", async () => {
    prismaMock.userFollow.deleteMany.mockResolvedValue({ count: 1 })
    const result = await unfollow("u1", "house", "h1")
    expect(result).toEqual({ success: true, following: false })
  })

  it("getFollowedIdsForViewer buckets ids", async () => {
    prismaMock.userFollow.findMany.mockResolvedValue([
      {
        followingUserId: "u2",
        followingHouseId: null,
        followingPerfumeId: null,
        followingHouse: null,
        followingPerfume: null,
      },
      {
        followingUserId: null,
        followingHouseId: "h1",
        followingPerfumeId: null,
        followingHouse: { slug: "house-a" },
        followingPerfume: null,
      },
    ])

    const ids = await getFollowedIdsForViewer("u1")
    expect(ids.userIds).toEqual(["u2"])
    expect(ids.houseIds).toEqual(["h1"])
    expect(ids.houseSlugs).toEqual(["house-a"])
  })
})
