import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getUserAlertsMock,
  getUnreadAlertCountsMock,
  getUnreadDirectMessageCountMock,
} = vi.hoisted(() => ({
  getUserAlertsMock: vi.fn(),
  getUnreadAlertCountsMock: vi.fn(),
  getUnreadDirectMessageCountMock: vi.fn(),
}))

vi.mock("@/models/user-alerts.server", () => ({
  getUserAlerts: (...args: unknown[]) => getUserAlertsMock(...args),
  getUnreadAlertCounts: (...args: unknown[]) => getUnreadAlertCountsMock(...args),
}))

vi.mock("@/models/contactMessage.server", () => ({
  getUnreadDirectMessageCount: (...args: unknown[]) =>
    getUnreadDirectMessageCountMock(...args),
}))

import { getNavBadgeBootstrap } from "./nav-bootstrap.server"

describe("getNavBadgeBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns alerts and counts from parallel helpers", async () => {
    const alerts = [{ id: "a1" }]
    getUserAlertsMock.mockResolvedValue(alerts)
    getUnreadAlertCountsMock.mockResolvedValue({
      unreadCount: 3,
      tradeUnreadCount: 1,
    })
    getUnreadDirectMessageCountMock.mockResolvedValue(2)

    const result = await getNavBadgeBootstrap("user-1")

    expect(result).toEqual({
      alerts,
      unreadCount: 3,
      tradeUnreadCount: 1,
      directMessageUnreadCount: 2,
    })
    expect(getUserAlertsMock).toHaveBeenCalledWith("user-1", 10)
    expect(getUnreadAlertCountsMock).toHaveBeenCalledWith("user-1")
    expect(getUnreadDirectMessageCountMock).toHaveBeenCalledWith("user-1")
  })
})
