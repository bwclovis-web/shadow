import { beforeEach, describe, expect, it, vi } from "vitest"

const notifySavedSearchMatchMock = vi.fn()
const getUserAlertPreferencesMock = vi.fn()
const requireEntitlementMock = vi.fn()
const prismaSavedSearchFindManyMock = vi.fn()
const prismaUserPerfumeFindManyMock = vi.fn()
const prismaPerfumeFindManyMock = vi.fn()

vi.mock("@/models/saved-search.server", async importOriginal => {
  const actual = await importOriginal<typeof import("@/models/saved-search.server")>()
  return {
    ...actual,
    notifySavedSearchMatch: (...args: unknown[]) =>
      notifySavedSearchMatchMock(...args),
  }
})

vi.mock("@/models/user-alerts.server", () => ({
  getUserAlertPreferences: (...args: unknown[]) =>
    getUserAlertPreferencesMock(...args),
}))

vi.mock("@/utils/membership/entitlements.server", () => ({
  requireEntitlement: (...args: unknown[]) => requireEntitlementMock(...args),
}))

vi.mock("@/utils/feature-flags", () => ({
  isFeatureEnabled: () => true,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    savedSearch: {
      findMany: (...args: unknown[]) => prismaSavedSearchFindManyMock(...args),
    },
    userPerfume: {
      findMany: (...args: unknown[]) => prismaUserPerfumeFindManyMock(...args),
    },
    perfume: {
      findMany: (...args: unknown[]) => prismaPerfumeFindManyMock(...args),
    },
  },
}))

import { runSavedSearchMatchPass } from "./saved-search-matcher.server"

describe("runSavedSearchMatchPass", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireEntitlementMock.mockResolvedValue({ ok: true })
    getUserAlertPreferencesMock.mockResolvedValue({
      savedSearchAlertsEnabled: true,
      savedSearchAlertFrequency: "instant",
    })
    notifySavedSearchMatchMock.mockResolvedValue({ id: "alert-1" })
    prismaUserPerfumeFindManyMock.mockResolvedValue([])
    prismaPerfumeFindManyMock.mockResolvedValue([])
  })

  it("skips snoozed saved searches", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    prismaSavedSearchFindManyMock.mockResolvedValue([
      {
        id: "search-1",
        userId: "user-1",
        name: "Oud",
        query: {},
        lastMatchedAt: null,
        snoozedUntil: future,
      },
    ])

    const result = await runSavedSearchMatchPass()

    expect(result.notified).toBe(0)
    expect(notifySavedSearchMatchMock).not.toHaveBeenCalled()
  })

  it("skips users with saved search alerts disabled", async () => {
    prismaSavedSearchFindManyMock.mockResolvedValue([
      {
        id: "search-1",
        userId: "user-1",
        name: "Oud",
        query: {},
        lastMatchedAt: null,
        snoozedUntil: null,
      },
    ])
    getUserAlertPreferencesMock.mockResolvedValue({
      savedSearchAlertsEnabled: false,
      savedSearchAlertFrequency: "instant",
    })

    const result = await runSavedSearchMatchPass()

    expect(result.notified).toBe(0)
    expect(notifySavedSearchMatchMock).not.toHaveBeenCalled()
  })

  it("passes daily delivery to notifySavedSearchMatch", async () => {
    prismaSavedSearchFindManyMock.mockResolvedValue([
      {
        id: "search-1",
        userId: "user-1",
        name: "Oud",
        query: { alertOnNewListing: true },
        lastMatchedAt: null,
        snoozedUntil: null,
      },
    ])
    getUserAlertPreferencesMock.mockResolvedValue({
      savedSearchAlertsEnabled: true,
      savedSearchAlertFrequency: "daily",
    })
    prismaUserPerfumeFindManyMock.mockResolvedValue([
      {
        id: "listing-1",
        userId: "user-2",
        perfume: {
          id: "perfume-1",
          name: "Test Oud",
          slug: "test-oud",
          perfumeHouse: { name: "House" },
        },
      },
    ])

    const result = await runSavedSearchMatchPass()

    expect(result.notified).toBe(1)
    expect(notifySavedSearchMatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery: "daily",
        savedSearchId: "search-1",
      })
    )
  })
})
