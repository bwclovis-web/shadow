import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfumeWishlist: {
      findMany: vi.fn(),
    },
    userPerfume: {
      findMany: vi.fn(),
    },
    userAlert: {
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/utils/alert-email.server", () => ({
  sendDecantInterestAlertEmail: vi.fn(),
  sendWishlistAlertEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/utils/push-notification.server", () => ({
  sendPushForUserAlert: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from "@/lib/db"
import { sendWishlistAlertEmail } from "@/utils/alert-email.server"

import { checkWishlistAvailabilityAlerts } from "./user-alerts.server"

const mockWishlistFindMany = vi.mocked(prisma.userPerfumeWishlist.findMany)
const mockUserPerfumeFindMany = vi.mocked(prisma.userPerfume.findMany)
const mockUserAlertCount = vi.mocked(prisma.userAlert.count)
const mockUserAlertFindMany = vi.mocked(prisma.userAlert.findMany)
const mockUserAlertUpdateMany = vi.mocked(prisma.userAlert.updateMany)
const mockUserAlertCreate = vi.mocked(prisma.userAlert.create)
const mockTransaction = vi.mocked(prisma.$transaction)
const mockSendWishlistAlertEmail = vi.mocked(sendWishlistAlertEmail)

const defaultPreferences = {
  id: "prefs-1",
  userId: "wishlist-user-1",
  wishlistAlertsEnabled: true,
  decantAlertsEnabled: true,
  emailWishlistAlerts: false,
  emailDecantAlerts: false,
  emailTradeAlerts: false,
  emailSecurityAlerts: true,
  securityAlertsEnabled: true,
  followAlertsEnabled: true,
  emailFollowAlerts: false,
  pushEnabled: false,
  pushTradeAlerts: true,
  pushMessageAlerts: true,
  pushFollowAlerts: true,
  maxAlerts: 10,
}

const wishlistUsers = [
  {
    userId: "wishlist-user-1",
    user: {
      id: "wishlist-user-1",
      email: "wishlist@example.com",
      firstName: "Wish",
      lastName: "Lister",
      username: "wishlister",
      profileSlug: "wishlister",
      alertPreferences: defaultPreferences,
    },
    perfume: {
      name: "Noir Epices",
      slug: "noir-epices",
      perfumeHouse: {
        name: "Frederic Malle",
      },
    },
  },
] as Awaited<ReturnType<typeof prisma.userPerfumeWishlist.findMany>>

describe("checkWishlistAvailabilityAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockTransaction.mockImplementation(async cb => {
      const tx = {
        userAlert: {
          count: mockUserAlertCount,
          findMany: mockUserAlertFindMany,
          updateMany: mockUserAlertUpdateMany,
          create: mockUserAlertCreate,
        },
      }

      return cb(tx as Parameters<typeof cb>[0])
    })

    mockWishlistFindMany.mockResolvedValue(wishlistUsers)
    mockUserPerfumeFindMany.mockResolvedValue([])
    mockUserAlertCount.mockResolvedValue(0)
    mockUserAlertFindMany.mockResolvedValue([])
    mockUserAlertUpdateMany.mockResolvedValue({ count: 0 })
    mockUserAlertCreate.mockResolvedValue({
      id: "alert-1",
      userId: "wishlist-user-1",
      perfumeId: "perfume-1",
      alertType: "wishlist_available",
      title: "Noir Epices is now available!",
      message: "Noir Epices by Frederic Malle is now available on the trading post from 1 trader(s).",
      isRead: false,
      isDismissed: false,
      metadata: null,
      createdAt: new Date(),
      readAt: null,
      dismissedAt: null,
      Perfume: null,
    } as Awaited<ReturnType<typeof prisma.userAlert.create>>)
  })

  it("does not create alerts when no active traders are available", async () => {
    const alerts = await checkWishlistAvailabilityAlerts("perfume-1", "trader-1")

    expect(alerts).toEqual([])
    expect(mockUserAlertCreate).not.toHaveBeenCalled()
    expect(mockSendWishlistAlertEmail).not.toHaveBeenCalled()
  })

  it("uses the distinct active trader count in the alert message", async () => {
    mockUserPerfumeFindMany.mockResolvedValue([
      {
        available: "5 ml",
        user: {
          id: "trader-1",
          firstName: "Ada",
          lastName: "Lovelace",
          username: "ada",
          email: "ada@example.com",
        },
      },
      {
        available: "2 ml",
        user: {
          id: "trader-1",
          firstName: "Ada",
          lastName: "Lovelace",
          username: "ada",
          email: "ada@example.com",
        },
      },
      {
        available: "0 ml",
        user: {
          id: "trader-ignored",
          firstName: "Zero",
          lastName: "Amount",
          username: "zero",
          email: "zero@example.com",
        },
      },
      {
        available: "1 ml",
        user: {
          id: "trader-2",
          firstName: "Grace",
          lastName: "Hopper",
          username: "grace",
          email: "grace@example.com",
        },
      },
    ] as Awaited<ReturnType<typeof prisma.userPerfume.findMany>>)

    const alerts = await checkWishlistAvailabilityAlerts("perfume-1")

    expect(alerts).toHaveLength(1)

    const createData = mockUserAlertCreate.mock.calls[0]?.[0]?.data
    expect(createData?.message).toContain("from 2 collector(s).")
    expect(createData?.metadata).toMatchObject({
      availableTraders: [
        { userId: "trader-1", displayName: "ada" },
        { userId: "trader-2", displayName: "grace" },
      ],
    })
    expect(
      (createData?.metadata as { availableTraders?: Array<{ email?: string }> })
        ?.availableTraders?.every((trader) => !("email" in trader))
    ).toBe(true)
    expect(mockSendWishlistAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("from 2 collector(s)."),
      })
    )
  })
})
