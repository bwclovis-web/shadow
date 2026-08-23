import { beforeEach, describe, expect, it, vi } from "vitest"

const createUserAlertMock = vi.fn()
const dispatchPushForUserAlertMock = vi.fn()
const getUserAlertPreferencesMock = vi.fn()
const requireEntitlementMock = vi.fn()
const sendSavedSearchAlertEmailMock = vi.fn()
const prismaSavedSearchAlertCreateMock = vi.fn()
const prismaSavedSearchUpdateMock = vi.fn()
const prismaUserFindUniqueMock = vi.fn()

vi.mock("@/models/user-alerts.server", () => ({
  createUserAlert: (...args: unknown[]) => createUserAlertMock(...args),
  dispatchPushForUserAlert: (...args: unknown[]) =>
    dispatchPushForUserAlertMock(...args),
  getUserAlertPreferences: (...args: unknown[]) =>
    getUserAlertPreferencesMock(...args),
}))

vi.mock("@/utils/membership/entitlements.server", () => ({
  requireEntitlement: (...args: unknown[]) => requireEntitlementMock(...args),
}))

vi.mock("@/utils/alert-email.server", () => ({
  sendSavedSearchAlertEmail: (...args: unknown[]) =>
    sendSavedSearchAlertEmailMock(...args),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    savedSearchAlert: {
      create: (...args: unknown[]) => prismaSavedSearchAlertCreateMock(...args),
    },
    savedSearch: {
      update: (...args: unknown[]) => prismaSavedSearchUpdateMock(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => prismaUserFindUniqueMock(...args),
    },
  },
}))

import { notifySavedSearchMatch } from "./saved-search.server"

describe("notifySavedSearchMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserAlertPreferencesMock.mockResolvedValue({
      savedSearchAlertsEnabled: true,
      savedSearchAlertFrequency: "instant",
      emailSavedSearchAlerts: false,
      pushSavedSearchAlerts: true,
    })
    requireEntitlementMock.mockResolvedValue({ ok: true })
    prismaSavedSearchAlertCreateMock.mockResolvedValue({ id: "ssa-1" })
    prismaSavedSearchUpdateMock.mockResolvedValue({ id: "search-1" })
    createUserAlertMock.mockResolvedValue({ id: "alert-1" })
    sendSavedSearchAlertEmailMock.mockResolvedValue(undefined)
    prismaUserFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      firstName: "Test",
      username: "testuser",
      profileSlug: "testuser",
    })
  })

  it("creates UserAlert with saved_search_match type for instant delivery", async () => {
    await notifySavedSearchMatch({
      userId: "user-1",
      savedSearchId: "search-1",
      title: "Match: Oud",
      message: "Found one",
      payload: { perfumeSlug: "test-oud", kind: "exchange_listing" },
      delivery: "instant",
    })

    expect(createUserAlertMock).toHaveBeenCalledWith(
      "user-1",
      null,
      "saved_search_match",
      "Match: Oud",
      "Found one",
      expect.objectContaining({
        savedSearchId: "search-1",
        kind: "saved_search_match",
        targetUrl: "/the-exchange",
        perfumeSlug: "test-oud",
      }),
      expect.any(Object)
    )
  })

  it("does not create UserAlert for daily delivery", async () => {
    const result = await notifySavedSearchMatch({
      userId: "user-1",
      savedSearchId: "search-1",
      title: "Match: Oud",
      message: "Found one",
      payload: { perfumeSlug: "test-oud" },
      delivery: "daily",
    })

    expect(result).toBeNull()
    expect(createUserAlertMock).not.toHaveBeenCalled()
    expect(prismaSavedSearchAlertCreateMock).toHaveBeenCalled()
  })

  it("returns null when saved search alerts are disabled", async () => {
    getUserAlertPreferencesMock.mockResolvedValue({
      savedSearchAlertsEnabled: false,
      savedSearchAlertFrequency: "instant",
    })

    const result = await notifySavedSearchMatch({
      userId: "user-1",
      savedSearchId: "search-1",
      title: "Match",
      message: "Found",
    })

    expect(result).toBeNull()
    expect(createUserAlertMock).not.toHaveBeenCalled()
    expect(prismaSavedSearchAlertCreateMock).not.toHaveBeenCalled()
  })
})
