import { beforeEach, describe, expect, it, vi } from "vitest"

import { createUserAlert } from "./user-alerts.server"

vi.mock("@/lib/db", () => ({
  prisma: {
    userAlert: {
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from "@/lib/db"

const mockCreate = vi.mocked(prisma.userAlert.create)
const mockTransaction = vi.mocked(prisma.$transaction)
const mockCount = vi.mocked(prisma.userAlert.count)
const mockFindMany = vi.mocked(prisma.userAlert.findMany)
const mockUpdateMany = vi.mocked(prisma.userAlert.updateMany)

const defaultPreferences = {
  id: "prefs-1",
  userId: "user-1",
  wishlistAlertsEnabled: true,
  decantAlertsEnabled: true,
  emailWishlistAlerts: false,
  emailDecantAlerts: false,
  maxAlerts: 10,
}

describe("createUserAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation(async cb => {
      const tx = {
        userAlert: {
          count: mockCount,
          findMany: mockFindMany,
          updateMany: mockUpdateMany,
          create: mockCreate,
        },
      }
      return cb(tx as Parameters<typeof cb>[0])
    })
    mockCount.mockResolvedValue(0)
    mockCreate.mockResolvedValue({
      id: "alert-1",
      userId: "user-1",
      perfumeId: null,
      alertType: "wishlist_available",
      title: "Test",
      message: "Test message",
      isRead: false,
      isDismissed: false,
      metadata: null,
      createdAt: new Date(),
      readAt: null,
      dismissedAt: null,
      Perfume: null,
    } as Awaited<ReturnType<typeof prisma.userAlert.create>>)
  })

  it("calls create with perfumeId when perfumeId is provided", async () => {
    await createUserAlert(
      "user-1",
      "perfume-123",
      "wishlist_available",
      "Title",
      "Message",
      undefined,
      defaultPreferences
    )

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const createData = mockCreate.mock.calls[0]?.[0]?.data
    expect(createData).toBeDefined()
    expect(createData).toHaveProperty("perfumeId", "perfume-123")
    expect(createData).toMatchObject({
      userId: "user-1",
      alertType: "wishlist_available",
      title: "Title",
      message: "Message",
    })
  })

  it("calls create without perfumeId when perfumeId is null", async () => {
    await createUserAlert(
      "user-1",
      null,
      "new_trader_message",
      "Title",
      "Message",
      undefined,
      defaultPreferences
    )

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const createData = mockCreate.mock.calls[0]?.[0]?.data
    expect(createData).toBeDefined()
    expect(createData).not.toHaveProperty("perfumeId")
    expect(createData).toMatchObject({
      userId: "user-1",
      alertType: "new_trader_message",
      title: "Title",
      message: "Message",
    })
  })

  it("respects preference flags and returns null when wishlist alerts disabled", async () => {
    const result = await createUserAlert(
      "user-1",
      "perfume-123",
      "wishlist_available",
      "Title",
      "Message",
      undefined,
      { ...defaultPreferences, wishlistAlertsEnabled: false }
    )

    expect(result).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("respects preference flags and returns null when decant alerts disabled", async () => {
    const result = await createUserAlert(
      "user-1",
      "perfume-123",
      "decant_interest",
      "Title",
      "Message",
      undefined,
      { ...defaultPreferences, decantAlertsEnabled: false }
    )

    expect(result).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
